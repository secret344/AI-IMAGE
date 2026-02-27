import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';

import { cn } from '@/lib/utils';

interface VisuallyHiddenProps extends React.HTMLAttributes<HTMLSpanElement> {
  asChild?: boolean;
}

/**
 * Visually hides content while keeping it accessible to screen readers.
 * Useful for hiding DialogTitle and other semantic elements that must exist
 * for accessibility but should not be visible on the screen.
 *
 * @example
 * // Hide DialogTitle visually but keep it for screen readers
 * <VisuallyHidden asChild>
 *   <DialogTitle>Settings</DialogTitle>
 * </VisuallyHidden>
 */
export const VisuallyHidden = React.forwardRef<HTMLSpanElement, VisuallyHiddenProps>(
  ({ className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'span';
    return (
      <Comp
        ref={ref}
        className={cn(
          'absolute w-1 h-1 p-0 m-[-1px] overflow-hidden clip-[rect(0,0,0,0)] whitespace-nowrap border-0',
          className
        )}
        {...props}
      />
    );
  }
);

VisuallyHidden.displayName = 'VisuallyHidden';
