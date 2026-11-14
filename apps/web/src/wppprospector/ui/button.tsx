import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

// Adapted from shadcn/ui's open-source Button pattern (MIT).
// Own token classes keep this marketing island separate from the portal CSS.
export const buttonVariants = cva('crm-ui-button', {
  variants: {
    variant: {
      primary: 'crm-ui-button--primary',
      outline: 'crm-ui-button--outline',
      ghost: 'crm-ui-button--ghost'
    },
    size: {
      normal: 'crm-ui-button--normal',
      icon: 'crm-ui-button--icon'
    }
  },
  defaultVariants: { variant: 'outline', size: 'icon' }
});

export type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Element = asChild ? Slot : 'button';
  return <Element
    data-slot="button"
    className={cn(buttonVariants({ variant, size, className }))}
    {...props}
  />;
}
