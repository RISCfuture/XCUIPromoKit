import { Brand } from '../components/Brand.tsx';
import { Timeline } from '../components/Timeline.tsx';
import type { PreviewProps } from '../props.ts';

/** An App Store app preview: the take's scenes, framed, captioned and joined as the storyboard says. */
export function Preview(props: PreviewProps) {
  return (
    <Brand css={props.brandCSS}>
      <Timeline timeline={props} />
    </Brand>
  );
}
