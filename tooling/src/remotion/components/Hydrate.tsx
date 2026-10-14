import { createElement, type ReactNode } from 'react';
import { attributesToProps, domToReact, type HTMLReactParserOptions } from 'html-react-parser';
import { Img, staticFile } from 'remotion';
import { footageFit, isTag, parseTemplate, type FootageFit } from '../../storyboard/template.ts';
import { CopyText } from './CopyText.tsx';

/**
 * Renders an app's HTML template, filling its hooks: an element with `data-copy="<id>"` gets that
 * copy, an `<img data-still="<name>">` shows that captured still, and an element with
 * `data-footage` holds `footage`, fitted as its value says (`cover` if blank). Other relative image URLs resolve against `base`, the template's
 * folder in the public folder. Scripts are dropped.
 */
export function Hydrate({
  template,
  copy,
  stills,
  base,
  footage,
}: {
  template: string;
  copy: Record<string, string>;
  stills: Record<string, string>;
  base: string;
  footage?: (fit: FootageFit) => ReactNode;
}) {
  const options: HTMLReactParserOptions = {
    replace(node) {
      if (!isTag(node)) return undefined;
      if (node.name === 'script') return <></>;
      const props = attributesToProps(node.attribs);
      const copyId = node.attribs['data-copy'];
      if (copyId !== undefined) return createElement(node.name, props, copyText(copy, copyId));
      const fit = node.attribs['data-footage'];
      if (fit !== undefined) return createElement(node.name, props, footage?.(footageFit(fit)));
      if (node.name !== 'img') return undefined;
      const still = node.attribs['data-still'];
      if (still !== undefined) return <Img {...props} src={staticFile(stillPath(stills, still))} />;
      const { src } = node.attribs;
      if (src !== undefined && isRelative(src))
        return <Img {...props} src={staticFile(`${base}/${src}`)} />;
      return undefined;
    },
  };
  return domToReact(parseTemplate(template), options);
}

function copyText(copy: Record<string, string>, id: string): ReactNode {
  const text = copy[id];
  if (text === undefined) throw new Error(`The copy has no “${id}”`);
  return <CopyText copy={text} />;
}

function stillPath(stills: Record<string, string>, name: string) {
  const file = stills[name];
  if (file === undefined) throw new Error(`No still named “${name}” was captured`);
  return file;
}

function isRelative(url: string) {
  return !/^([a-z][a-z0-9+.-]*:|\/)/i.test(url);
}
