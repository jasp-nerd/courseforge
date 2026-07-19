import { XMLParser } from 'fast-xml-parser';
import { unzipSync } from 'fflate';
import type { ManifestOrgItem, ManifestResource } from './builder/manifest.js';
import { PATHS } from './constants.js';

/**
 * Reads a .imscc into an in-memory model. Cartridges are untrusted input:
 * we guard against zip-slip (hostile entry paths), zip bombs (entry count and
 * uncompressed size caps), and XXE (fast-xml-parser never resolves external
 * entities or DTDs).
 */

export interface ParsedModuleItem {
  identifier: string;
  contentType: string;
  workflowState: string;
  title: string;
  identifierref?: string;
  url?: string;
  position: number;
  indent: number;
}

export interface ParsedModule {
  identifier: string;
  title: string;
  workflowState: string;
  position: number;
  requireSequentialProgress: boolean;
  items: ParsedModuleItem[];
}

export interface ParsedAssignmentGroup {
  identifier: string;
  title: string;
  position: number;
  weight: number;
}

export interface ParsedCartridge {
  manifestIdentifier: string;
  title: string;
  schemaVersion: string;
  /** True when the Canvas flag file (course_settings/canvas_export.txt) is present. */
  isCanvasCartridge: boolean;
  /** Top-level organization items (modules) with their nested items. */
  organization: ManifestOrgItem[];
  resources: ManifestResource[];
  /** Canvas module_meta.xml content; undefined for non-Canvas cartridges. */
  moduleMeta?: ParsedModule[];
  assignmentGroups?: ParsedAssignmentGroup[];
  /** Every zip entry except imsmanifest.xml, byte-for-byte. */
  files: Map<string, Uint8Array>;
}

export interface ParseOptions {
  maxEntries?: number;
  maxTotalBytes?: number;
}

const DEFAULT_MAX_ENTRIES = 20_000;
const DEFAULT_MAX_TOTAL_BYTES = 2 * 1024 * 1024 * 1024; // 2 GiB uncompressed

const ARRAY_PATHS = new Set([
  'manifest.organizations.organization',
  'manifest.resources.resource',
  'modules.module',
  'assignmentGroups.assignmentGroup',
]);

function makeParser(): XMLParser {
  return new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
    isArray: (name, jpath) =>
      ARRAY_PATHS.has(String(jpath)) || name === 'item' || name === 'file' || name === 'dependency',
  });
}

// biome-ignore lint/suspicious/noExplicitAny: raw parsed XML is inherently untyped
type Raw = any;

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function str(value: unknown): string {
  return value === undefined || value === null ? '' : String(value);
}

export function isSafeEntryPath(path: string): boolean {
  if (path.length === 0 || path.startsWith('/') || /^[A-Za-z]:/.test(path)) return false;
  if (path.includes('\\')) return false;
  return !path.split('/').some((segment) => segment === '..');
}

const utf8 = new TextDecoder('utf-8');

/** Unzip with hardening; returns all entries (directories excluded). */
export function unzipCartridge(
  bytes: Uint8Array,
  options: ParseOptions = {},
): Map<string, Uint8Array> {
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const maxTotalBytes = options.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES;
  let entryCount = 0;
  let totalBytes = 0;

  const unzipped = unzipSync(bytes, {
    filter: (info) => {
      if (info.name.endsWith('/')) return false;
      entryCount += 1;
      if (entryCount > maxEntries) {
        throw new Error(`cartridge has more than ${maxEntries} entries; refusing to extract`);
      }
      if (!isSafeEntryPath(info.name)) {
        throw new Error(`unsafe zip entry path: ${JSON.stringify(info.name)}`);
      }
      totalBytes += info.originalSize ?? 0;
      if (totalBytes > maxTotalBytes) {
        throw new Error(`cartridge expands past ${maxTotalBytes} bytes; refusing to extract`);
      }
      return true;
    },
  });

  const files = new Map<string, Uint8Array>();
  for (const [name, data] of Object.entries(unzipped)) files.set(name, data);
  return files;
}

function parseOrgItem(raw: Raw): ManifestOrgItem {
  return {
    identifier: str(raw['@_identifier']),
    title: raw.title !== undefined ? str(raw.title) : undefined,
    identifierref: raw['@_identifierref'] !== undefined ? str(raw['@_identifierref']) : undefined,
    children: asArray(raw.item).map(parseOrgItem),
  };
}

function parseManifest(
  xml: string,
): Pick<
  ParsedCartridge,
  'manifestIdentifier' | 'title' | 'schemaVersion' | 'organization' | 'resources'
> {
  const doc = makeParser().parse(xml) as Raw;
  const manifest = doc.manifest;
  if (!manifest) throw new Error('imsmanifest.xml has no <manifest> root');

  const lomTitle = manifest.metadata?.lom?.general?.title?.string;
  const organizations = asArray(manifest.organizations?.organization);
  const rootItems = asArray(organizations[0]?.item);
  // Canvas wraps modules in a single "LearningModules" item; be lenient about its absence.
  const wrapper =
    rootItems.length === 1 && !rootItems[0]?.['@_identifierref'] ? rootItems[0] : undefined;
  const moduleItems = wrapper ? asArray(wrapper.item) : rootItems;

  const resources = asArray(manifest.resources?.resource).map(
    (resource: Raw): ManifestResource => ({
      identifier: str(resource['@_identifier']),
      type: str(resource['@_type']),
      href: resource['@_href'] !== undefined ? str(resource['@_href']) : undefined,
      intendedUse:
        resource['@_intendeduse'] !== undefined ? str(resource['@_intendeduse']) : undefined,
      files: asArray(resource.file).map((f: Raw) => str(f['@_href'])),
      dependencies: asArray(resource.dependency).map((d: Raw) => str(d['@_identifierref'])),
    }),
  );

  return {
    manifestIdentifier: str(manifest['@_identifier']),
    title: lomTitle !== undefined ? str(lomTitle) : 'Untitled course',
    schemaVersion: str(manifest.metadata?.schemaversion ?? ''),
    organization: moduleItems.map(parseOrgItem),
    resources,
  };
}

function parseModuleMeta(xml: string): ParsedModule[] {
  const doc = makeParser().parse(xml) as Raw;
  return asArray(doc.modules?.module).map(
    (mod: Raw): ParsedModule => ({
      identifier: str(mod['@_identifier']),
      title: str(mod.title),
      workflowState: str(mod.workflow_state ?? 'unpublished'),
      position: Number(mod.position ?? 0),
      requireSequentialProgress: str(mod.require_sequential_progress) === 'true',
      items: asArray(mod.items?.item).map(
        (item: Raw): ParsedModuleItem => ({
          identifier: str(item['@_identifier']),
          contentType: str(item.content_type),
          workflowState: str(item.workflow_state ?? 'active'),
          title: str(item.title),
          identifierref: item.identifierref !== undefined ? str(item.identifierref) : undefined,
          url: item.url !== undefined && str(item.url) !== '' ? str(item.url) : undefined,
          position: Number(item.position ?? 0),
          indent: Number(item.indent ?? 0),
        }),
      ),
    }),
  );
}

function parseAssignmentGroups(xml: string): ParsedAssignmentGroup[] {
  const doc = makeParser().parse(xml) as Raw;
  return asArray(doc.assignmentGroups?.assignmentGroup).map((group: Raw) => ({
    identifier: str(group['@_identifier']),
    title: str(group.title),
    position: Number(group.position ?? 0),
    weight: Number(group.group_weight ?? 0),
  }));
}

/** Parse a .imscc (bytes) into a model. */
export function readCartridge(bytes: Uint8Array, options: ParseOptions = {}): ParsedCartridge {
  const entries = unzipCartridge(bytes, options);
  const manifestBytes = entries.get(PATHS.manifest);
  if (!manifestBytes) throw new Error('not a Common Cartridge: missing imsmanifest.xml');
  entries.delete(PATHS.manifest);

  const manifest = parseManifest(utf8.decode(manifestBytes));
  const isCanvasCartridge = entries.has(PATHS.flag);

  let moduleMeta: ParsedModule[] | undefined;
  const moduleMetaBytes = entries.get(PATHS.moduleMeta);
  if (moduleMetaBytes) moduleMeta = parseModuleMeta(utf8.decode(moduleMetaBytes));

  let assignmentGroups: ParsedAssignmentGroup[] | undefined;
  const groupBytes = entries.get(PATHS.assignmentGroups);
  if (groupBytes) assignmentGroups = parseAssignmentGroups(utf8.decode(groupBytes));

  return {
    ...manifest,
    isCanvasCartridge,
    moduleMeta,
    assignmentGroups,
    files: entries,
  };
}
