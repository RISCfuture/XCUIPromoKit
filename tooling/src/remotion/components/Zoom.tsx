import type { ReactNode } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Zoom as ZoomProps } from '../../storyboard/schema.ts';
import { cameraAt } from './camera.ts';

/** Moves the camera over its content through `zooms` in turn, timed from the scene's arrival. */
export function Zoom({
  zooms,
  arrivalFrames,
  children,
}: {
  zooms: ZoomProps[];
  arrivalFrames: number;
  children: ReactNode;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (zooms.length === 0) return <AbsoluteFill>{children}</AbsoluteFill>;

  const { scale, x, y } = cameraAt(zooms, (frame - arrivalFrames) / fps);
  return (
    <AbsoluteFill
      style={{
        transform: `translate(${x * 100}%, ${y * 100}%) scale(${scale})`,
        transformOrigin: '0 0',
      }}
    >
      {children}
    </AbsoluteFill>
  );
}
