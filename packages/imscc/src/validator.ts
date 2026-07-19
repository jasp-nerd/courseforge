import { isValidCartridgeId } from '@courseforge/shared';
import type { ManifestOrgItem } from './builder/manifest.js';
import { PATHS } from './constants.js';
import { type ParsedCartridge, readCartridge } from './parser.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

function flattenOrg(items: ManifestOrgItem[]): ManifestOrgItem[] {
  return items.flatMap((item) => [item, ...flattenOrg(item.children)]);
}

/**
 * Check the cross-reference invariants that make Canvas imports succeed.
 * Orphan references are the #1 cause of silent import failures.
 */
export function validateCartridge(input: Uint8Array | ParsedCartridge): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  let model: ParsedCartridge;
  try {
    model = input instanceof Uint8Array ? readCartridge(input) : input;
  } catch (error) {
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : String(error)],
      warnings,
    };
  }

  const resourceIds = new Map<string, number>();
  for (const resource of model.resources) {
    resourceIds.set(resource.identifier, (resourceIds.get(resource.identifier) ?? 0) + 1);
  }
  for (const [id, count] of resourceIds) {
    if (count > 1) errors.push(`duplicate resource identifier: ${id}`);
    if (!isValidCartridgeId(id)) errors.push(`resource identifier is not a valid XML id: ${id}`);
  }

  // 1. Organization identifierrefs resolve.
  for (const item of flattenOrg(model.organization)) {
    if (item.identifierref && !resourceIds.has(item.identifierref)) {
      errors.push(
        `organization item "${item.title ?? item.identifier}" references missing resource ${item.identifierref}`,
      );
    }
  }

  // 2. Resource files exist; dependencies resolve.
  for (const resource of model.resources) {
    for (const href of resource.files) {
      if (!model.files.has(href)) {
        errors.push(`resource ${resource.identifier} declares missing file ${href}`);
      }
    }
    if (resource.href && !model.files.has(resource.href)) {
      errors.push(`resource ${resource.identifier} href points to missing file ${resource.href}`);
    }
    for (const dep of resource.dependencies) {
      if (!resourceIds.has(dep)) {
        errors.push(`resource ${resource.identifier} depends on missing resource ${dep}`);
      }
    }
  }

  // 3. module_meta identifierrefs resolve.
  if (model.moduleMeta) {
    const groupIds = new Set((model.assignmentGroups ?? []).map((g) => g.identifier));
    for (const mod of model.moduleMeta) {
      for (const item of mod.items) {
        if (item.identifierref && !resourceIds.has(item.identifierref)) {
          // Canvas's own exports contain these (it skips them on import), so warn rather than fail.
          warnings.push(
            `module_meta item "${item.title}" (module "${mod.title}") references missing resource ${item.identifierref}`,
          );
        }
        if (item.contentType === 'ExternalUrl' && !item.url) {
          errors.push(`module_meta ExternalUrl item "${item.title}" has no url`);
        }
      }
      if (!isValidCartridgeId(mod.identifier)) {
        errors.push(`module identifier is not a valid XML id: ${mod.identifier}`);
      }
    }
    if (model.assignmentGroups && groupIds.size === 0) {
      warnings.push('assignment_groups.xml is present but declares no groups');
    }
  }

  // 4. Undeclared files (warning — some LMS exports have stragglers Canvas ignores).
  const declared = new Set<string>();
  for (const resource of model.resources) {
    for (const href of resource.files) declared.add(href);
    if (resource.href) declared.add(resource.href);
  }
  for (const path of model.files.keys()) {
    if (
      !declared.has(path) &&
      !path.startsWith(`${PATHS.courseSettingsDir}/`) &&
      !path.startsWith(`${PATHS.nonCcAssessments}/`)
    ) {
      warnings.push(`file not declared by any resource: ${path}`);
    }
  }

  if (!model.isCanvasCartridge) {
    warnings.push(
      'no course_settings/canvas_export.txt flag — Canvas will import this as a generic Common Cartridge (module/assignment/quiz settings will be lost)',
    );
  }

  return { valid: errors.length === 0, errors, warnings };
}
