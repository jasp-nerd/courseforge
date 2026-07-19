export type QueryValue = string | number | boolean | Array<string | number>;
export type QueryParams = Record<string, QueryValue | undefined>;

/**
 * Canvas query encoding: arrays become repeated bracket keys
 * (include[]=a&include[]=b), which URLSearchParams alone won't produce for us.
 */
export function encodeQuery(params: QueryParams | undefined, append = false): string {
  if (!params) return '';
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      const bracket = key.endsWith('[]') ? key : `${key}[]`;
      for (const entry of value) {
        parts.push(`${encodeURIComponent(bracket)}=${encodeURIComponent(String(entry))}`);
      }
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }
  if (parts.length === 0) return '';
  return `${append ? '&' : '?'}${parts.join('&')}`;
}
