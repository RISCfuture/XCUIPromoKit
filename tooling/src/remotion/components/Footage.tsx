import {
  Freeze,
  OffthreadVideo,
  Series,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type { CSSProperties } from 'react';
import { footageAt } from '../../storyboard/speed.ts';
import type { FootageFit } from '../../storyboard/template.ts';
import type { Clip } from '../props.ts';

/** A scene's kept stretches of the take, back to back, filling the frame or box as `fit` says. */
export function Footage({
  video,
  clips,
  fit = 'cover',
}: {
  video: string;
  clips: Clip[];
  fit?: FootageFit;
}) {
  const fill: CSSProperties = { width: '100%', height: '100%', objectFit: fit };
  return (
    <Series>
      {clips.map((clip, index) => (
        <Series.Sequence key={index} durationInFrames={clip.durationInFrames}>
          {clip.speed ? (
            <PacedClip video={video} from={clip.from} speed={clip.speed} fill={fill} />
          ) : (
            <OffthreadVideo src={staticFile(video)} trimBefore={clip.from} muted style={fill} />
          )}
        </Series.Sequence>
      ))}
    </Series>
  );
}

/** A clip played at its speed, showing for each frame the footage frame its pace has reached. */
function PacedClip({
  video,
  from,
  speed,
  fill,
}: {
  video: string;
  from: number;
  speed: NonNullable<Clip['speed']>;
  fill: CSSProperties;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const footage = footageAt(frame / fps, speed.footageFrames / fps, speed);
  const shown = Math.min(Math.round(footage * fps), speed.footageFrames - 1);
  return (
    <Freeze frame={shown}>
      <OffthreadVideo src={staticFile(video)} trimBefore={from} muted style={fill} />
    </Freeze>
  );
}
