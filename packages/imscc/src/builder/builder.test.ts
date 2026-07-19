import { sequentialIdGenerator } from '@courseforge/shared';
import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { CANVAS_EXPORT_FLAG, PATHS } from '../constants.js';
import { readCartridge } from '../parser.js';
import { demoSpec } from '../test-helpers.js';
import { validateCartridge } from '../validator.js';
import { buildCartridge } from './index.js';

const decoder = new TextDecoder();

function buildDemo() {
  return buildCartridge(demoSpec, { idGenerator: sequentialIdGenerator() });
}

describe('buildCartridge', () => {
  it('produces a valid cartridge with zero errors', () => {
    const { bytes } = buildDemo();
    const result = validateCartridge(bytes);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('is deterministic with a seeded id generator', () => {
    expect(buildDemo().bytes).toEqual(buildDemo().bytes);
  });

  it('emits the Canvas flag file with the exact expected content', () => {
    const model = readCartridge(buildDemo().bytes);
    expect(model.isCanvasCartridge).toBe(true);
    expect(decoder.decode(model.files.get(PATHS.flag))).toBe(CANVAS_EXPORT_FLAG);
  });

  it('puts imsmanifest.xml first in the zip', () => {
    const { bytes } = buildDemo();
    // Local file header: filename starts at byte 30.
    const nameLength = bytes[26]! | (bytes[27]! << 8);
    const name = decoder.decode(bytes.slice(30, 30 + nameLength));
    expect(name).toBe('imsmanifest.xml');
  });

  it('round-trips: parsed structure matches the spec', () => {
    const model = readCartridge(buildDemo().bytes);
    expect(model.title).toBe('Introduction to Chemistry');
    expect(model.schemaVersion).toBe('1.1.0');

    expect(model.moduleMeta).toBeDefined();
    const meta = model.moduleMeta ?? [];
    expect(meta.map((m) => m.title)).toEqual(['Week 1 — Matter', 'Week 2 — Atoms']);
    expect(meta[0]?.workflowState).toBe('active');
    expect(meta[1]?.workflowState).toBe('unpublished');

    const week1Types = meta[0]?.items.map((i) => i.contentType);
    expect(week1Types).toEqual([
      'ContextModuleSubHeader',
      'WikiPage',
      'ExternalUrl',
      'Assignment',
      'DiscussionTopic',
    ]);
    const week2Types = meta[1]?.items.map((i) => i.contentType);
    expect(week2Types).toEqual(['Quizzes::Quiz', 'Attachment']);

    const link = meta[0]?.items[2];
    expect(link?.url).toBe('https://chem.libretexts.org/intro');

    // Organization mirrors module_meta (minus the url-only nuances).
    expect(model.organization.map((m) => m.title)).toEqual(['Week 1 — Matter', 'Week 2 — Atoms']);
    expect(model.organization[0]?.children).toHaveLength(5);

    expect(model.assignmentGroups?.map((g) => [g.title, g.weight])).toEqual([
      ['Assignments', 60],
      ['Participation', 40],
    ]);

    // Uploaded file lands under web_resources/ and syllabus is present.
    expect(model.files.has('web_resources/handouts/periodic-table.txt')).toBe(true);
    expect(model.files.has(PATHS.syllabus)).toBe(true);
  });

  it('applies the styling banner to page bodies', () => {
    const model = readCartridge(buildDemo().bytes);
    const pagePath = [...model.files.keys()].find((p) => p.startsWith('wiki_content/'));
    expect(pagePath).toBeDefined();
    const html = decoder.decode(model.files.get(pagePath as string));
    expect(html).toContain('<div class="cf-banner">CHEM-101</div>');
    expect(html).toContain('<meta name="editing_roles" content="teachers"/>');
  });

  it('fails clearly when a file item has no content', () => {
    expect(() =>
      buildCartridge({
        course: { title: 'X' },
        modules: [{ name: 'M', items: [{ type: 'file', title: 'F', path: 'a.txt' }] }],
      }),
    ).toThrow(/has no content/);
  });

  it('golden: imsmanifest.xml is stable', async () => {
    const manifest = extract(buildDemo().bytes, 'imsmanifest.xml');
    await expect(manifest).toMatchFileSnapshot('__snapshots__/imsmanifest.golden.xml');
  });

  it('golden: module_meta.xml is stable', async () => {
    const moduleMeta = extract(buildDemo().bytes, PATHS.moduleMeta);
    await expect(moduleMeta).toMatchFileSnapshot('__snapshots__/module_meta.golden.xml');
  });

  it('golden: quiz QTI is stable', async () => {
    const model = readCartridge(buildDemo().bytes);
    const qtiPath = [...model.files.keys()].find((p) => p.endsWith('assessment_qti.xml'));
    const qti = decoder.decode(model.files.get(qtiPath as string));
    await expect(qti).toMatchFileSnapshot('__snapshots__/assessment_qti.golden.xml');
  });
});

function extract(bytes: Uint8Array, path: string): string {
  return decoder.decode(unzipSync(bytes)[path]);
}
