import type { CSSProperties } from 'react';
import { Img, staticFile } from 'remotion';
import { Brand } from '../components/Brand.tsx';
import { CopyText } from '../components/CopyText.tsx';
import { Highlights } from '../components/Highlights.tsx';
import type { ScreenshotProps } from '../props.ts';
import type { WindowSize } from '../../render/window.ts';

/**
 * A captioned App Store screenshot: a headline and the still, laid out entirely by brand.css. A
 * window grabbed from the screen gets a `.promo-window-shadow` under it, and the window's size in
 * points, which its corners and shadow scale by.
 */
export function Screenshot(props: ScreenshotProps) {
  const image = (
    <>
      {props.window && <div className="promo-window-shadow" />}
      <Img className="promo-screen" src={staticFile(props.still)} />
      {props.highlights && <Highlights regions={props.highlights} />}
    </>
  );
  return (
    <Brand css={props.brandCSS} theme={props.theme}>
      <div
        className="promo-screenshot"
        data-layout={props.layout}
        data-capture={props.capture}
        style={props.window && windowSize(props.window)}
      >
        {props.caption && (
          <h1 className="promo-headline" data-copy={props.caption.id}>
            <CopyText copy={props.caption.text} />
          </h1>
        )}
        {props.layout === 'mac' ? <div className="promo-window">{image}</div> : image}
      </div>
    </Brand>
  );
}

function windowSize({ width, height }: WindowSize) {
  return { '--promo-window-width': width, '--promo-window-height': height } as CSSProperties;
}
