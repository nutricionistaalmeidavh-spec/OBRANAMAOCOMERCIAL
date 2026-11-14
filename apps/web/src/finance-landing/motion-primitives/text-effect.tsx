import { motion, useReducedMotion } from 'motion/react';

/** Local Motion Primitives-style reveal. Never hides copy from assistive tech. */
export function TextEffect({ text }: { text: string }) {
  const reduced = useReducedMotion();
  if (reduced) return <span>{text}</span>;
  return (
    <span className="finance-text-effect" aria-label={text}>
      {text.split(' ').map((word, index) => (
        <motion.span
          key={index}
          aria-hidden="true"
          initial={{ opacity: 0.58, y: 9 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.7 }}
          transition={{ delay: index * 0.055, duration: 0.47, ease: [0.22, 1, 0.36, 1] }}
        >
          {word}{index < text.split(' ').length - 1 ? '\u00a0' : ''}
        </motion.span>
      ))}
    </span>
  );
}
