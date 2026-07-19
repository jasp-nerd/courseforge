/**
 * Minimal XML writer. We generate cartridge XML from explicit element trees so
 * namespace prefixes, attribute order, and element order are fully under our
 * control (Canvas's importer is picky about all three).
 */

export interface XmlElement {
  name: string;
  attrs?: Record<string, string | number | boolean | undefined>;
  children?: Array<XmlElement | string>;
  /** Raw pre-escaped content (used for CDATA-free HTML-entity-escaped bodies). */
  raw?: string;
}

export function el(
  name: string,
  attrs?: XmlElement['attrs'],
  children?: Array<XmlElement | string | undefined | null | false>,
): XmlElement {
  return {
    name,
    attrs,
    children: children?.filter(
      (c): c is XmlElement | string => c !== undefined && c !== null && c !== false,
    ),
  };
}

export function text(name: string, value: string | number | boolean): XmlElement {
  return { name, children: [String(value)] };
}

export function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderAttrs(attrs?: XmlElement['attrs']): string {
  if (!attrs) return '';
  let out = '';
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined) continue;
    out += ` ${key}="${escapeXml(String(value))}"`;
  }
  return out;
}

function renderNode(node: XmlElement | string, indent: number, pretty: boolean): string {
  const pad = pretty ? '  '.repeat(indent) : '';
  const nl = pretty ? '\n' : '';
  if (typeof node === 'string') return `${escapeXml(node)}`;

  const attrs = renderAttrs(node.attrs);
  const children = node.children ?? [];
  const hasElementChildren = children.some((c) => typeof c !== 'string');

  if (node.raw !== undefined) {
    return `${pad}<${node.name}${attrs}>${node.raw}</${node.name}>${nl}`;
  }
  if (children.length === 0) {
    return `${pad}<${node.name}${attrs}/>${nl}`;
  }
  if (!hasElementChildren) {
    const content = children.map((c) => renderNode(c, 0, false)).join('');
    return `${pad}<${node.name}${attrs}>${content}</${node.name}>${nl}`;
  }
  const inner = children
    .map((c) =>
      typeof c === 'string'
        ? `${'  '.repeat(indent + 1)}${escapeXml(c)}${nl}`
        : renderNode(c, indent + 1, pretty),
    )
    .join('');
  return `${pad}<${node.name}${attrs}>${nl}${inner}${pad}</${node.name}>${nl}`;
}

export function renderXml(root: XmlElement, declaration = true): string {
  const body = renderNode(root, 0, true);
  return declaration ? `<?xml version="1.0" encoding="UTF-8"?>\n${body}` : body;
}
