import * as React from 'react';
import type { CSSProperties } from 'react';

/** Local Magic UI-inspired visual primitive. Pure CSS, no paid API or CDN. */
export function BorderBeam({ duration = 5 }: { duration?: number }) {
  return (
    <span
      className="finance-border-beam"
      aria-hidden="true"
      style={{ '--finance-beam-duration': duration + 's' } as CSSProperties}
    />
  );
}
