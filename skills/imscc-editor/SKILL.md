---
name: imscc-editor
description: Read, inspect, modify, validate, or repair Canvas LMS .imscc / IMS Common Cartridge course export files. Use whenever the user has a .imscc (or Common Cartridge .zip) file and wants to see what's inside, add/edit/remove pages, assignments, quizzes, or modules, fix a cartridge that fails to import into Canvas, or do the export → modify → re-import round-trip. Triggers on any mention of .imscc, Common Cartridge, Canvas course export/import files, or "why won't my cartridge import".
---

# IMSCC editor

A `.imscc` is a ZIP with `imsmanifest.xml` plus Canvas extension XMLs. The `@courseforge/imscc` library understands both; the full format anatomy is in [references/imscc-format.md](references/imscc-format.md) — consult it whenever a field is ambiguous.

## Inspect

```bash
npx courseforge-imscc inspect course.imscc     # structure as JSON
npx courseforge-imscc validate course.imscc    # cross-reference invariants (the #1 import-failure cause)
```

## Modify (export → modify → re-import loop)

Use the library in a small Node script (`pnpm add @courseforge/imscc` or run inside the CourseForge repo):

```js
import { readFileSync, writeFileSync } from 'node:fs';
import { CartridgeEditor, validateCartridge } from '@courseforge/imscc';

const ed = CartridgeEditor.fromBytes(readFileSync('export.imscc'));
console.log(ed.listModules());

ed.addItem('Week 1', { type: 'page', title: 'Office hours', body: '<p>Tue 14:00</p>' });
ed.addModule('Week 9 — Review');
ed.removeItem('Week 2', 'Old quiz');

const bytes = ed.toBytes();
console.log(validateCartridge(bytes));   // must have zero errors before shipping
writeFileSync('export-modified.imscc', bytes);
```

Item inputs are CourseSpec module items (see the canvas-course-builder skill's course-spec reference): `page`, `assignment`, `quiz` (+questions), `discussion`, `link`, `file`, `header`.

Key rules the editor enforces for you — don't work around them by hand-editing XML:
- identifiers stay stable across edits, so Canvas **updates** instead of duplicating on re-import
- manifest organization ↔ `module_meta.xml` stay consistent
- removing an item removes its resources and files only when nothing else references them

## Repair a failing import

1. `validate` — every error names the dangling reference or missing file.
2. Typical causes: an `identifierref` pointing at a deleted resource, a `<file href>` missing from the zip, `imsmanifest.xml` not at the zip root, ids starting with a digit.
3. Fix via `CartridgeEditor` (or parse with `readCartridge`, adjust, re-serialize), re-validate, then re-import.
4. If Canvas imported but content is missing: check the migration issues (MCP tool `list_migration_issues`) and whether the cartridge lacked the Canvas flag file (`course_settings/canvas_export.txt`) — without it Canvas ignores all module/assignment settings.

## Push back into Canvas

With courseforge-mcp connected: `import_course_package` (course_id + file path). Manually: Canvas → Settings → Import Course Content → Common Cartridge 1.x Package.
