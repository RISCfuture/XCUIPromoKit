import { useEffect, useState, type ReactNode } from 'react';
import { AbsoluteFill, continueRender, delayRender, staticFile } from 'remotion';
import { structure } from './structure.ts';

/**
 * Lays down the kit's structural CSS, then loads the app's brand.css and any other stylesheets, in
 * order, and the fonts they declare, before the first frame renders. The app's CSS decides every
 * visual: see `structure.ts` for the hooks.
 */
export function Brand({
  css,
  theme,
  children,
}: {
  css: string | readonly string[];
  theme?: string;
  children: ReactNode;
}) {
  const sheets = typeof css === 'string' ? [css] : css;
  const key = sheets.join('\n');
  const [handle] = useState(() => delayRender(`Loading ${sheets.join(', ')}`));

  useEffect(() => {
    const links = key.split('\n').map(stylesheet);
    void Promise.all(links.map(({ loaded }) => loaded))
      .then(() => document.fonts.ready)
      .then(() => {
        continueRender(handle);
      });
    return () => {
      for (const { link } of links) link.remove();
    };
  }, [key, handle]);

  return (
    <AbsoluteFill className="promo-root" data-theme={theme}>
      <style>{structure}</style>
      {children}
    </AbsoluteFill>
  );
}

/** Adds the stylesheet at `file` in the public folder to the page. */
function stylesheet(file: string) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = staticFile(file);
  const loaded = new Promise<void>((resolve) => {
    link.onload = () => {
      resolve();
    };
    link.onerror = () => {
      throw new Error(`Couldn't load ${file}`);
    };
  });
  document.head.append(link);
  return { link, loaded };
}
