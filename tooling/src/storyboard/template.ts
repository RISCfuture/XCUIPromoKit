import { htmlToDOM } from 'html-react-parser';

/**
 * The copy ids and still names a creative's HTML template asks the kit to fill, and the value of
 * each `data-footage` box.
 */
export type TemplateHooks = { copy: Set<string>; stills: Set<string>; footage: string[] };

/** How footage fills a `data-footage` box, as CSS `object-fit`; the attribute's value names one. */
export const footageFits = ['cover', 'contain', 'fill', 'none', 'scale-down'] as const;
export type FootageFit = (typeof footageFits)[number];

/** Whether a `data-footage` value names a fit, or is blank. */
export function isFootageFit(value: string): value is FootageFit | '' {
  return value === '' || footageFits.some((fit) => fit === value);
}

/** The fit a `data-footage` value names: `cover` if it's blank. Throws for any other value. */
export function footageFit(value: string): FootageFit {
  if (!isFootageFit(value))
    throw new Error(`data-footage is “${value}”; use one of ${footageFits.join(', ')}`);
  return value === '' ? 'cover' : value;
}

/** An element of a parsed template. */
export type TagNode = {
  name: string;
  attribs: Record<string, string>;
  children: readonly unknown[];
};

/**
 * Whether a parsed node is an element. Checked by shape, not `instanceof`: the parser's ESM and
 * CommonJS builds each bring their own copy of the element class.
 */
export function isTag(node: unknown): node is TagNode {
  return typeof node === 'object' && node !== null && 'attribs' in node && 'name' in node;
}

/** Parses a template as the renderer does, keeping attribute names' case. */
export function parseTemplate(html: string) {
  return htmlToDOM(html, { lowerCaseAttributeNames: false });
}

/** Reads a template's hooks: every `data-copy` id, every `data-still` on an `<img>`, and `data-footage`. */
export function templateHooks(html: string): TemplateHooks {
  const hooks: TemplateHooks = { copy: new Set(), stills: new Set(), footage: [] };
  const visit = (nodes: readonly unknown[]) => {
    for (const node of nodes) {
      if (!isTag(node)) continue;
      const { 'data-copy': copy, 'data-still': still } = node.attribs;
      if (copy !== undefined) hooks.copy.add(copy);
      if (node.name === 'img' && still !== undefined) hooks.stills.add(still);
      const footage = node.attribs['data-footage'];
      if (footage !== undefined) hooks.footage.push(footage);
      visit(node.children);
    }
  };
  visit(parseTemplate(html));
  return hooks;
}
