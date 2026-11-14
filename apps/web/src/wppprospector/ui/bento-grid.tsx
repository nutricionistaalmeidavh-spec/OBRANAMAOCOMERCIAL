import * as React from 'react';
import { cn } from '../lib/utils';
import { MagicCard } from './magic-card';

// Adapted from Magic UI Bento Grid (MIT).
// Precisely packed 7x2 + 5x1 + 5x1 across a 12-column CSS grid.
export function BentoGrid({ children }: React.PropsWithChildren) {
  return <div className="crm-bento-grid">{children}</div>;
}

export function BentoCard({
  children,
  featured = false,
}: React.PropsWithChildren<{ featured?: boolean }>) {
  return (
    <MagicCard className={cn('crm-bento-item', featured && 'crm-bento-featured')}>
      <div className="crm-bento-content">{children}</div>
    </MagicCard>
  );
}
