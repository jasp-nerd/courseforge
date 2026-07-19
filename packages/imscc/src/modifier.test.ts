import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sequentialIdGenerator } from '@courseforge/shared';
import { describe, expect, it } from 'vitest';
import { buildCartridge } from './builder/index.js';
import { CartridgeEditor } from './modifier.js';
import { readCartridge } from './parser.js';
import { demoSpec } from './test-helpers.js';
import { validateCartridge } from './validator.js';

const FIXTURES = join(__dirname, '../../../fixtures/cartridges');

function editor(bytes: Uint8Array): CartridgeEditor {
  return CartridgeEditor.fromBytes(bytes, { idGenerator: sequentialIdGenerator('e') });
}

function demoBytes(): Uint8Array {
  return buildCartridge(demoSpec, { idGenerator: sequentialIdGenerator() }).bytes;
}

describe('CartridgeEditor on generated cartridges', () => {
  it('adds a page to an existing module and stays valid', () => {
    const ed = editor(demoBytes());
    ed.addItem('Week 1 — Matter', {
      type: 'page',
      title: 'Office hours',
      body: '<p>Tuesdays 14:00</p>',
    });
    const bytes = ed.toBytes();
    expect(validateCartridge(bytes).errors).toEqual([]);

    const model = readCartridge(bytes);
    const week1 = model.moduleMeta?.find((m) => m.title === 'Week 1 — Matter');
    expect(week1?.items.map((i) => i.title)).toContain('Office hours');
    expect(week1?.items.at(-1)?.position).toBe(week1?.items.length);
    const orgWeek1 = model.organization.find((m) => m.title === 'Week 1 — Matter');
    expect(orgWeek1?.children.map((c) => c.title)).toContain('Office hours');
  });

  it('adds a new module with a quiz', () => {
    const ed = editor(demoBytes());
    const moduleId = ed.addModule('Week 3 — Bonds');
    ed.addItem(moduleId, {
      type: 'quiz',
      title: 'Bonding basics',
      questions: [
        { type: 'true_false', text: '<p>Ionic bonds share electrons.</p>', correct: false },
      ],
    });
    const bytes = ed.toBytes();
    expect(validateCartridge(bytes).errors).toEqual([]);
    const model = readCartridge(bytes);
    expect(model.moduleMeta?.map((m) => m.title)).toContain('Week 3 — Bonds');
    const week3 = model.moduleMeta?.find((m) => m.title === 'Week 3 — Bonds');
    expect(week3?.items[0]?.contentType).toBe('Quizzes::Quiz');
  });

  it('removes an item together with its unreferenced resources and files', () => {
    const before = readCartridge(demoBytes());
    const quizFiles = [...before.files.keys()].filter((p) => p.endsWith('assessment_qti.xml'));
    expect(quizFiles).toHaveLength(1);

    const ed = editor(demoBytes());
    expect(ed.removeItem('Week 2 — Atoms', 'Atoms checkpoint')).toBe(true);
    const bytes = ed.toBytes();
    expect(validateCartridge(bytes).errors).toEqual([]);

    const model = readCartridge(bytes);
    expect([...model.files.keys()].some((p) => p.endsWith('assessment_qti.xml'))).toBe(false);
    expect([...model.files.keys()].some((p) => p.endsWith('assessment_meta.xml'))).toBe(false);
    const week2 = model.moduleMeta?.find((m) => m.title === 'Week 2 — Atoms');
    expect(week2?.items.map((i) => i.title)).not.toContain('Atoms checkpoint');
  });

  it('returns false when removing a nonexistent item and throws on bad module', () => {
    const ed = editor(demoBytes());
    expect(ed.removeItem('Week 1 — Matter', 'No such thing')).toBe(false);
    expect(() => ed.addItem('No module', { type: 'header', title: 'X' })).toThrow(
      /module not found/,
    );
  });
});

describe('CartridgeEditor on a real Canvas export (export → modify → re-import loop)', () => {
  const fixtureBytes = new Uint8Array(
    readFileSync(join(FIXTURES, 'canvas-summer-template-export.imscc')),
  );

  it('round-trips a real export without introducing validation errors', () => {
    const originalErrors = validateCartridge(fixtureBytes).errors;
    const bytes = editor(fixtureBytes).toBytes();
    const result = validateCartridge(bytes);
    expect(result.errors).toEqual(originalErrors);
  });

  it('preserves module structure and identifiers across a round-trip', () => {
    const before = readCartridge(fixtureBytes);
    const after = readCartridge(editor(fixtureBytes).toBytes());
    expect(after.title).toBe(before.title);
    expect(after.moduleMeta?.map((m) => m.identifier)).toEqual(
      before.moduleMeta?.map((m) => m.identifier),
    );
    expect(after.moduleMeta?.flatMap((m) => m.items.map((i) => i.identifierref))).toEqual(
      before.moduleMeta?.flatMap((m) => m.items.map((i) => i.identifierref)),
    );
    expect(after.resources.map((r) => r.identifier).sort()).toEqual(
      before.resources.map((r) => r.identifier).sort(),
    );
  });

  it('adds a page to a real export and keeps it importable', () => {
    const ed = editor(fixtureBytes);
    const modules = ed.listModules();
    expect(modules.length).toBeGreaterThan(0);
    ed.addItem((modules[0] as { identifier: string }).identifier, {
      type: 'page',
      title: 'Added by CourseForge',
      body: '<p>This page was added programmatically.</p>',
    });
    const result = validateCartridge(ed.toBytes());
    expect(result.errors).toEqual([]);
  });
});
