import * as React from 'react';
import type { ReactNode } from 'react';
import Tilt from 'react-parallax-tilt';

/** Opt-in desktop depth only. No gyroscope access, glare, or touch hijacking. */
export default function OptionalTilt({ children }: { children: ReactNode }) {
  return (
    <Tilt
      tiltMaxAngleX={3}
      tiltMaxAngleY={3}
      tiltReverse={false}
      perspective={1450}
      transitionSpeed={1100}
      scale={1}
      glareEnable={false}
      gyroscope={false}
      tiltEnable
      className="finance-tilt-shell"
    >
      {children}
    </Tilt>
  );
}
