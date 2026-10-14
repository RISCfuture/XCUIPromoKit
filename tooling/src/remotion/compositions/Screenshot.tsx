import { Img, staticFile } from 'remotion';
import { Brand } from '../components/Brand.tsx';
import { CopyText } from '../components/CopyText.tsx';
import { Highlights } from '../components/Highlights.tsx';
import type { ScreenshotProps } from '../props.ts';

/** A captioned App Store screenshot: a headline and the still, laid out entirely by brand.css. */
export function Screenshot(props: ScreenshotProps) {
  const image = (
    <>
      <Img className="promo-screen" src={staticFile(props.still)} />
      {props.highlights && <Highlights regions={props.highlights} />}
    </>
  );
  return (
    <Brand css={props.brandCSS} theme={props.theme}>
      <div className="promo-screenshot" data-layout={props.layout}>
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
