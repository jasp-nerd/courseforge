/**
 * Canvas-style cartridge identifiers: "g" + 32 hex chars. XML ids must be
 * NCNames (cannot start with a digit), hence the letter prefix.
 */

export type IdGenerator = () => string;

// Web Crypto is global in Node ≥20 and all browsers; typed structurally to stay lib-agnostic.
const webCrypto = (
  globalThis as unknown as { crypto: { getRandomValues(array: Uint8Array): Uint8Array } }
).crypto;

export function randomId(): string {
  const bytes = new Uint8Array(16);
  webCrypto.getRandomValues(bytes);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return `g${hex}`;
}

/**
 * Deterministic generator for tests and reproducible builds: gaaaa...0001, 0002, ...
 * Produces the same "g" + 32-char shape as randomId.
 */
export function sequentialIdGenerator(prefix = 'a'): IdGenerator {
  let n = 0;
  return () => {
    n += 1;
    return `g${prefix.repeat(24)}${String(n).padStart(8, '0')}`;
  };
}

export function isValidCartridgeId(id: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(id);
}
