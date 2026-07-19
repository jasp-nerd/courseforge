#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { buildCartridge } from './builder/index.js';
import { readCartridge } from './parser.js';
import { validateCartridge } from './validator.js';

const HELP = `courseforge-imscc — build, validate, and inspect Canvas .imscc course files

Usage:
  courseforge-imscc build <spec.json> [-o out.imscc]   Build a cartridge from a CourseSpec
  courseforge-imscc validate <file.imscc>              Check cross-reference invariants
  courseforge-imscc inspect <file.imscc>               Print course structure as JSON

The CourseSpec format is documented at https://github.com/jasp-nerd/courseforge
File items with a "path" but no contentBase64 are read relative to the spec file.`;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function loadSpecFiles(specPath: string, spec: unknown): Record<string, Uint8Array> {
  const files: Record<string, Uint8Array> = {};
  const baseDir = dirname(resolve(specPath));
  const modules =
    (spec as { modules?: Array<{ items?: Array<Record<string, unknown>> }> }).modules ?? [];
  for (const mod of modules) {
    for (const item of mod.items ?? []) {
      if (item.type === 'file' && typeof item.path === 'string' && !item.contentBase64) {
        try {
          files[item.path] = new Uint8Array(readFileSync(join(baseDir, item.path)));
        } catch {
          // leave it missing; the builder reports a precise error
        }
      }
    }
  }
  return files;
}

function main(): void {
  const [command, target, ...rest] = process.argv.slice(2);

  if (!command || command === '--help' || command === '-h') {
    console.log(HELP);
    return;
  }

  switch (command) {
    case 'build': {
      if (!target) fail(`build: missing <spec.json>\n\n${HELP}`);
      const spec: unknown = JSON.parse(readFileSync(target, 'utf8'));
      const outFlag = rest.indexOf('-o');
      const result = buildCartridge(spec, { files: loadSpecFiles(target, spec) });
      const outPath =
        outFlag !== -1 && rest[outFlag + 1] ? (rest[outFlag + 1] as string) : result.filename;
      writeFileSync(outPath, result.bytes);
      const validation = validateCartridge(result.bytes);
      console.log(`✔ wrote ${outPath} (${result.bytes.length.toLocaleString()} bytes)`);
      for (const warning of validation.warnings) console.log(`  warning: ${warning}`);
      if (!validation.valid) {
        for (const error of validation.errors) console.error(`  error: ${error}`);
        fail('build produced an invalid cartridge — please report this as a bug');
      }
      break;
    }

    case 'validate': {
      if (!target) fail(`validate: missing <file.imscc>\n\n${HELP}`);
      const result = validateCartridge(new Uint8Array(readFileSync(target)));
      for (const error of result.errors) console.error(`error: ${error}`);
      for (const warning of result.warnings) console.log(`warning: ${warning}`);
      if (!result.valid) fail(`✘ ${target} is invalid (${result.errors.length} error(s))`);
      console.log(`✔ ${target} is valid (${result.warnings.length} warning(s))`);
      break;
    }

    case 'inspect': {
      if (!target) fail(`inspect: missing <file.imscc>\n\n${HELP}`);
      const model = readCartridge(new Uint8Array(readFileSync(target)));
      const summary = {
        title: model.title,
        schemaVersion: model.schemaVersion,
        isCanvasCartridge: model.isCanvasCartridge,
        resourceCount: model.resources.length,
        fileCount: model.files.size,
        modules: (model.moduleMeta ?? []).map((mod) => ({
          title: mod.title,
          workflowState: mod.workflowState,
          items: mod.items.map((item) => ({
            title: item.title,
            type: item.contentType,
            workflowState: item.workflowState,
          })),
        })),
        organization: model.organization.map((mod) => ({
          title: mod.title,
          itemCount: mod.children.length,
        })),
      };
      console.log(JSON.stringify(summary, null, 2));
      break;
    }

    default:
      fail(`unknown command: ${command}\n\n${HELP}`);
  }
}

main();
