import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { isSafeEntryPath, readCartridge, unzipCartridge } from './parser.js';
import { validateCartridge } from './validator.js';

const FIXTURES = join(__dirname, '../../../fixtures/cartridges');

function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(FIXTURES, name)));
}

describe('readCartridge on real LMS exports', () => {
  it('parses a full Canvas export with Canvas metadata', () => {
    const model = readCartridge(fixture('canvas-summer-template-export.imscc'));
    expect(model.isCanvasCartridge).toBe(true);
    expect(model.title.length).toBeGreaterThan(0);
    expect(model.resources.length).toBeGreaterThan(10);
    expect(model.moduleMeta?.length).toBeGreaterThan(0);
    expect(model.assignmentGroups?.length).toBeGreaterThan(0);
    const contentTypes = new Set(
      (model.moduleMeta ?? []).flatMap((m) => m.items.map((i) => i.contentType)),
    );
    expect(contentTypes.has('WikiPage')).toBe(true);
  });

  it('parses every vendored fixture without crashing', () => {
    const names = readdirSync(FIXTURES).filter((n) => n.endsWith('.imscc'));
    expect(names.length).toBeGreaterThanOrEqual(8);
    for (const name of names) {
      const model = readCartridge(fixture(name));
      expect(model.resources.length, name).toBeGreaterThan(0);
    }
  });

  it('validates the Canvas fixtures with zero errors', () => {
    for (const name of [
      'canvas-summer-template-export.imscc',
      'sample-public-sandbox-course-export.imscc',
    ]) {
      const result = validateCartridge(fixture(name));
      expect(result.errors, `${name}: ${result.errors.join('; ')}`).toEqual([]);
    }
  });

  it('flags a cartridge with a dangling reference', () => {
    const model = readCartridge(fixture('single-page.imscc'));
    // Sabotage: drop all files a resource declares.
    const victim = model.resources.find((r) => r.files.length > 0);
    for (const path of victim?.files ?? []) model.files.delete(path);
    const result = validateCartridge(model);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('missing file'))).toBe(true);
  });
});

describe('untrusted-zip hardening', () => {
  it('rejects zip-slip entry paths', () => {
    expect(isSafeEntryPath('../../etc/passwd')).toBe(false);
    expect(isSafeEntryPath('/etc/passwd')).toBe(false);
    expect(isSafeEntryPath('C:/windows/evil')).toBe(false);
    expect(isSafeEntryPath('a/../../b')).toBe(false);
    expect(isSafeEntryPath('a\\b')).toBe(false);
    expect(isSafeEntryPath('wiki_content/page.html')).toBe(true);

    const evil = zipSync({
      '../evil.txt': strToU8('boom'),
      'imsmanifest.xml': strToU8('<manifest/>'),
    });
    expect(() => unzipCartridge(evil)).toThrow(/unsafe zip entry/);
  });

  it('rejects cartridges with too many entries', () => {
    const entries: Record<string, Uint8Array> = { 'imsmanifest.xml': strToU8('<manifest/>') };
    for (let i = 0; i < 20; i++) entries[`f${i}.txt`] = strToU8('x');
    const bytes = zipSync(entries);
    expect(() => unzipCartridge(bytes, { maxEntries: 10 })).toThrow(/more than 10 entries/);
  });

  it('rejects cartridges that expand past the size cap', () => {
    const big = strToU8('a'.repeat(200_000));
    const bytes = zipSync({ 'imsmanifest.xml': strToU8('<manifest/>'), 'big.txt': big });
    expect(() => unzipCartridge(bytes, { maxTotalBytes: 100_000 })).toThrow(/expands past/);
  });

  it('rejects non-cartridge zips', () => {
    const bytes = zipSync({ 'readme.txt': strToU8('hello') });
    expect(() => readCartridge(bytes)).toThrow(/missing imsmanifest.xml/);
  });
});
