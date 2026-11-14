import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import clsx from 'clsx';

/** Source-owned shadcn/ui button pattern. All colors remain ArtiSys tokens. */
const buttonVariants = cva('finance-ui-button', {
  variants: {
    variant: {
      primary: 'finance-ui-button--primary',
      secondary: 'finance-ui-button--secondary',
      ghost: 'finance-ui-button--ghost',
    },
    size: { default: 'finance-ui-button--default', icon: 'finance-ui-button--icon' },
  },
  defaultVariants: { variant: 'secondary', size: 'default' },
});

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type = 'button', ...props }, ref) => {
    const Component = asChild ? Slot : 'button';
    return (
      <Component
        {...props}
        type={type}
        ref={ref}
        className={clsx(buttonVariants({ variant, size }), className)}
      />
    );
  }
);
Button.displayName = 'FinanceButton';
