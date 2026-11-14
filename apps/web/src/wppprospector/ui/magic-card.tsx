import * as React from 'react';
import { motion, useMotionTemplate, useMotionValue } from 'motion/react';
import { cn } from '../lib/utils';

// Adapted from the open-source Magic UI MagicCard (MIT, Magic UI).
// Light follows pointer, but only the border/glow moves; screen content stays authentic.
export function MagicCard({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) {
  const x = useMotionValue(-400);
  const y = useMotionValue(-400);
  const halo = useMotionTemplate`radial-gradient(230px circle at ${x}px ${y}px, rgba(178,118,255,.88), rgba(56,180,202,.32) 58%, rgba(148,113,202,.23) 100%)`;

  return (
    <motion.div
      className={cn('crm-magic-card', className)}
      style={{ background: halo }}
      onPointerMove={(event) => {
        if (event.pointerType === 'touch') return;
        const rect = event.currentTarget.getBoundingClientRect();
        x.set(event.clientX - rect.left);
        y.set(event.clientY - rect.top);
      }}
      onPointerLeave={() => { x.set(-400); y.set(-400); }}
    >
      <div className="crm-magic-card-inner">{children}</div>
    </motion.div>
  );
}
