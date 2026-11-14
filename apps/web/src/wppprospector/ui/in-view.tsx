import * as React from 'react';
import { motion, useInView, useReducedMotion } from 'motion/react';

// Adapted from ibelick/motion-primitives InView (MIT).
export function InView({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) {
  const ref = React.useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { once: true, amount: 0.13 });
  const reduce = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={reduce ? false : { opacity: 0, y: 17 }}
      animate={reduce || visible ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
