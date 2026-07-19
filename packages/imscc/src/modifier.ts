import { type IdGenerator, moduleItemSchema, randomId } from '@courseforge/shared';
import { zipSync } from 'fflate';
import { writeAssignmentGroups, writeModuleMeta } from './builder/canvas-settings.js';
import { slugify, writeItem } from './builder/item-writer.js';
import { writeManifest } from './builder/manifest.js';
import { PATHS } from './constants.js';
import type { ParsedCartridge, ParsedModule } from './parser.js';
import { readCartridge } from './parser.js';
import { renderXml } from './xml.js';

/**
 * Edits an existing cartridge (typically a Canvas export) while keeping
 * imsmanifest.xml, module_meta.xml, and the content files consistent — the
 * export → modify → re-import loop. Existing identifiers are preserved so
 * Canvas updates content instead of duplicating it.
 */
export class CartridgeEditor {
  private readonly model: ParsedCartridge;
  private readonly nextId: IdGenerator;
  private readonly encoder = new TextEncoder();

  constructor(model: ParsedCartridge, options: { idGenerator?: IdGenerator } = {}) {
    this.model = model;
    this.nextId = options.idGenerator ?? randomId;
  }

  static fromBytes(
    bytes: Uint8Array,
    options: { idGenerator?: IdGenerator } = {},
  ): CartridgeEditor {
    return new CartridgeEditor(readCartridge(bytes), options);
  }

  get cartridge(): ParsedCartridge {
    return this.model;
  }

  listModules(): Array<{ title: string; identifier: string; itemCount: number }> {
    const source = this.model.moduleMeta ?? [];
    if (source.length > 0) {
      return source.map((m) => ({
        title: m.title,
        identifier: m.identifier,
        itemCount: m.items.length,
      }));
    }
    return this.model.organization.map((m) => ({
      title: m.title ?? m.identifier,
      identifier: m.identifier,
      itemCount: m.children.length,
    }));
  }

  /** Add an empty module; returns its identifier. */
  addModule(name: string, options: { published?: boolean } = {}): string {
    const identifier = this.nextId();
    this.model.organization.push({ identifier, title: name, children: [] });
    if (this.model.moduleMeta) {
      this.model.moduleMeta.push({
        identifier,
        title: name,
        workflowState: options.published ? 'active' : 'unpublished',
        position: this.model.moduleMeta.length + 1,
        requireSequentialProgress: false,
        items: [],
      });
    }
    return identifier;
  }

  /**
   * Add a module item (page, assignment, quiz, discussion, link, file, header).
   * `moduleRef` is a module title or identifier; the input is a CourseSpec module item.
   */
  addItem(moduleRef: string, itemInput: unknown): { resourceIdentifier?: string } {
    const item = moduleItemSchema.parse(itemInput);
    const orgModule = this.model.organization.find(
      (m) => m.identifier === moduleRef || m.title === moduleRef,
    );
    if (!orgModule) throw new Error(`module not found: ${moduleRef}`);
    const metaModule = this.model.moduleMeta?.find((m) => m.identifier === orgModule.identifier);

    const usedSlugs = new Set(
      [...this.model.files.keys()]
        .filter((p) => p.startsWith(`${PATHS.wikiContent}/`))
        .map((p) => p.slice(PATHS.wikiContent.length + 1).replace(/\.html$/, '')),
    );
    const groups = this.model.assignmentGroups ?? [];
    let assignmentPosition = this.countAssignments();

    const written = writeItem(item, {
      nextId: this.nextId,
      resolveGroup: (name?: string) => {
        const match = name ? groups.find((g) => g.title === name) : undefined;
        const fallback = groups[0] ?? this.ensureAssignmentGroup();
        return (match ?? fallback).identifier;
      },
      uniqueSlug: (title: string) => {
        const base = slugify(title);
        let slug = base;
        let n = 2;
        while (usedSlugs.has(slug)) slug = `${base}-${n++}`;
        usedSlugs.add(slug);
        return slug;
      },
      nextAssignmentPosition: () => ++assignmentPosition,
    });

    for (const [path, bytes] of written.files) this.model.files.set(path, bytes);
    this.model.resources.push(...written.resources);
    orgModule.children.push(written.orgItem);
    metaModule?.items.push({ ...written.metaItem, position: metaModule.items.length + 1 });
    return { resourceIdentifier: written.metaItem.identifierref };
  }

  /** Remove a module item by title (and its resources/files when nothing else references them). */
  removeItem(moduleRef: string, itemTitle: string): boolean {
    const orgModule = this.model.organization.find(
      (m) => m.identifier === moduleRef || m.title === moduleRef,
    );
    if (!orgModule) throw new Error(`module not found: ${moduleRef}`);
    const metaModule = this.model.moduleMeta?.find((m) => m.identifier === orgModule.identifier);

    const orgIndex = orgModule.children.findIndex((c) => c.title === itemTitle);
    const metaIndex = metaModule ? metaModule.items.findIndex((i) => i.title === itemTitle) : -1;
    if (orgIndex === -1 && metaIndex === -1) return false;

    const removedRefs = new Set<string>();
    if (orgIndex !== -1) {
      const [removed] = orgModule.children.splice(orgIndex, 1);
      if (removed?.identifierref) removedRefs.add(removed.identifierref);
    }
    if (metaModule && metaIndex !== -1) {
      const [removed] = metaModule.items.splice(metaIndex, 1);
      if (removed?.identifierref) removedRefs.add(removed.identifierref);
      metaModule.items.forEach((item, i) => {
        item.position = i + 1;
      });
    }

    for (const ref of removedRefs) this.removeResourceIfUnreferenced(ref);
    return true;
  }

  /** Serialize back to .imscc bytes, regenerating manifest + Canvas metadata. */
  toBytes(): Uint8Array {
    const manifest = writeManifest({
      manifestIdentifier: this.model.manifestIdentifier,
      title: this.model.title,
      organizationRoot: this.model.organization,
      resources: this.model.resources,
      schemaVersion: this.model.schemaVersion || undefined,
    });

    if (this.model.isCanvasCartridge && this.model.moduleMeta) {
      this.model.files.set(
        PATHS.moduleMeta,
        this.encoder.encode(renderXml(writeModuleMeta(this.model.moduleMeta))),
      );
    }
    if (this.model.isCanvasCartridge && this.model.assignmentGroups) {
      this.model.files.set(
        PATHS.assignmentGroups,
        this.encoder.encode(renderXml(writeAssignmentGroups(this.model.assignmentGroups))),
      );
    }

    const zipEntries: Record<string, Uint8Array> = {
      [PATHS.manifest]: this.encoder.encode(renderXml(manifest)),
    };
    for (const [path, bytes] of this.model.files) zipEntries[path] = bytes;
    return zipSync(zipEntries, { level: 6 });
  }

  private countAssignments(): number {
    return (this.model.moduleMeta ?? []).reduce(
      (sum, mod) => sum + mod.items.filter((i) => i.contentType === 'Assignment').length,
      0,
    );
  }

  private ensureAssignmentGroup(): { identifier: string } {
    if (!this.model.assignmentGroups) this.model.assignmentGroups = [];
    if (this.model.assignmentGroups.length === 0) {
      this.model.assignmentGroups.push({
        identifier: this.nextId(),
        title: 'Assignments',
        position: 1,
        weight: 0,
      });
    }
    return this.model.assignmentGroups[0] as { identifier: string };
  }

  private isReferencedInOrg(identifier: string): boolean {
    const walk = (items: typeof this.model.organization): boolean =>
      items.some((item) => item.identifierref === identifier || walk(item.children));
    return walk(this.model.organization);
  }

  private removeResourceIfUnreferenced(identifier: string): void {
    const stillReferenced =
      this.isReferencedInOrg(identifier) ||
      (this.model.moduleMeta ?? []).some((m: ParsedModule) =>
        m.items.some((i) => i.identifierref === identifier),
      ) ||
      this.model.resources.some((r) => r.dependencies.includes(identifier));
    if (stillReferenced) return;

    const index = this.model.resources.findIndex((r) => r.identifier === identifier);
    if (index === -1) return;
    const [resource] = this.model.resources.splice(index, 1);
    if (!resource) return;

    const filesStillUsed = new Set(
      this.model.resources.flatMap((r) => [...r.files, ...(r.href ? [r.href] : [])]),
    );
    for (const path of resource.files) {
      if (!filesStillUsed.has(path)) this.model.files.delete(path);
    }
    // Cascade to dependency resources (e.g. a quiz's assessment_meta LOR).
    for (const dep of resource.dependencies) this.removeResourceIfUnreferenced(dep);
  }
}
