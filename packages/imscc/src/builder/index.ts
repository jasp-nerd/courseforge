import { type CourseSpec, type IdGenerator, parseCourseSpec, randomId } from '@courseforge/shared';
import { zipSync } from 'fflate';
import { CANVAS_EXPORT_FLAG, PATHS, RESOURCE_TYPE } from '../constants.js';
import { renderXml, type XmlElement } from '../xml.js';
import {
  type AssignmentGroupInput,
  type MetaModuleInput,
  writeAssignmentGroups,
  writeCourseSettings,
  writeEmptyStub,
  writeModuleMeta,
} from './canvas-settings.js';
import { slugify, writeItem } from './item-writer.js';
import { type ManifestOrgItem, type ManifestResource, writeManifest } from './manifest.js';

export interface BuildOptions {
  /** Override for deterministic builds/tests. Defaults to crypto-random Canvas-style ids. */
  idGenerator?: IdGenerator;
  /** Bytes for `file` items, keyed by their spec `path`. Overrides contentBase64. */
  files?: Record<string, Uint8Array>;
}

export interface BuildResult {
  bytes: Uint8Array;
  /** Suggested filename, e.g. "intro-to-chemistry.imscc". */
  filename: string;
  spec: CourseSpec;
}

const encoder = new TextEncoder();

/** Build a Canvas-flavored Common Cartridge (.imscc) from a CourseSpec. */
export function buildCartridge(specInput: unknown, options: BuildOptions = {}): BuildResult {
  const spec = parseCourseSpec(specInput);
  const nextId: IdGenerator = options.idGenerator ?? randomId;

  const files = new Map<string, Uint8Array>();
  const resources: ManifestResource[] = [];
  const orgModules: ManifestOrgItem[] = [];
  const metaModules: MetaModuleInput[] = [];

  const putXml = (path: string, xml: XmlElement) => {
    files.set(path, encoder.encode(renderXml(xml)));
  };

  const groups: AssignmentGroupInput[] = spec.assignmentGroups.map((group, i) => ({
    identifier: nextId(),
    title: group.name,
    position: i + 1,
    weight: group.weight,
  }));
  const defaultGroupId = (groups[0] as AssignmentGroupInput).identifier;
  const groupIdByName = new Map(groups.map((g) => [g.title, g.identifier]));

  const usedSlugs = new Set<string>();
  let assignmentPosition = 0;
  const ctx = {
    nextId,
    resolveGroup: (name?: string) => (name && groupIdByName.get(name)) || defaultGroupId,
    uniqueSlug: (title: string) => {
      const base = slugify(title);
      let slug = base;
      let n = 2;
      while (usedSlugs.has(slug)) slug = `${base}-${n++}`;
      usedSlugs.add(slug);
      return slug;
    },
    nextAssignmentPosition: () => ++assignmentPosition,
    bannerHtml: spec.styling?.bannerHtml,
    fileBytes: options.files,
  };

  for (const [moduleIndex, mod] of spec.modules.entries()) {
    const moduleId = nextId();
    const orgChildren: ManifestOrgItem[] = [];
    const metaItems: MetaModuleInput['items'] = [];

    for (const [itemIndex, item] of mod.items.entries()) {
      const written = writeItem(item, ctx);
      for (const [path, bytes] of written.files) files.set(path, bytes);
      resources.push(...written.resources);
      orgChildren.push(written.orgItem);
      metaItems.push({ ...written.metaItem, position: itemIndex + 1 });
    }

    orgModules.push({ identifier: moduleId, title: mod.name, children: orgChildren });
    metaModules.push({
      identifier: moduleId,
      title: mod.name,
      workflowState: mod.published ? 'active' : 'unpublished',
      position: moduleIndex + 1,
      requireSequentialProgress: mod.requireSequentialProgress,
      items: metaItems,
    });
  }

  const courseId = nextId();
  files.set(PATHS.flag, encoder.encode(CANVAS_EXPORT_FLAG));
  putXml(
    PATHS.courseSettings,
    writeCourseSettings({
      identifier: courseId,
      title: spec.course.title,
      courseCode: spec.course.code ?? spec.course.title,
      defaultView: spec.course.defaultView,
    }),
  );
  putXml(PATHS.moduleMeta, writeModuleMeta(metaModules));
  putXml(PATHS.assignmentGroups, writeAssignmentGroups(groups));
  putXml(PATHS.rubrics, writeEmptyStub('rubrics'));
  putXml(PATHS.filesMeta, writeEmptyStub('fileMeta'));
  putXml(PATHS.mediaTracks, writeEmptyStub('media_tracks'));

  if (spec.course.syllabus !== undefined) {
    files.set(
      PATHS.syllabus,
      encoder.encode(
        `<html>\n<head>\n<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>\n<title>Syllabus</title>\n</head>\n<body>\n${spec.course.syllabus}\n</body>\n</html>\n`,
      ),
    );
    resources.push({
      identifier: `${courseId}_syllabus`,
      type: RESOURCE_TYPE.lor,
      href: PATHS.syllabus,
      intendedUse: 'syllabus',
      files: [PATHS.syllabus],
      dependencies: [],
    });
  }

  resources.push({
    identifier: courseId,
    type: RESOURCE_TYPE.lor,
    href: PATHS.flag,
    files: [
      PATHS.courseSettings,
      PATHS.moduleMeta,
      PATHS.assignmentGroups,
      PATHS.rubrics,
      PATHS.filesMeta,
      PATHS.mediaTracks,
      PATHS.flag,
    ],
    dependencies: [],
  });

  const manifest = writeManifest({
    manifestIdentifier: nextId(),
    title: spec.course.title,
    organizationRoot: orgModules,
    resources,
  });

  // imsmanifest.xml must be the first zip entry; the rest follow in insertion order.
  const zipEntries: Record<string, Uint8Array> = {
    [PATHS.manifest]: encoder.encode(renderXml(manifest)),
  };
  for (const [path, bytes] of files) zipEntries[path] = bytes;

  const bytes = zipSync(zipEntries, { level: 6 });
  return { bytes, filename: `${slugify(spec.course.title)}.imscc`, spec };
}
