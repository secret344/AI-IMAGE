import * as React from 'react';
import * as MenubarPrimitive from '@radix-ui/react-menubar';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from './lib/utils';

const menuItemVariants = cva(
  'flex w-full items-start justify-start rounded-md px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      active: {
        true: 'bg-primary text-primary-foreground',
        false: 'text-foreground hover:bg-accent hover:text-accent-foreground'
      }
    },
    defaultVariants: {
      active: false
    }
  }
);

export interface MenuProps extends React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Root> {}

export const Menu = React.forwardRef<React.ElementRef<typeof MenubarPrimitive.Root>, MenuProps>(
  ({ className, ...props }, ref) => {
    return (
      <MenubarPrimitive.Root
        ref={ref}
        className={cn(
          'flex h-auto w-full flex-col items-stretch gap-1 rounded-md border border-border/60 bg-card/60 p-2',
          className
        )}
        {...props}
      />
    );
  }
);

Menu.displayName = 'Menu';

export interface MenuItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof menuItemVariants> {
  description?: string;
}

export const MenuItem = React.forwardRef<HTMLButtonElement, MenuItemProps>(
  ({ className, active, children, description, ...props }, ref) => {
    return (
      <MenubarPrimitive.Menu>
        <MenubarPrimitive.Trigger
          ref={ref}
          className={cn(menuItemVariants({ active }), className)}
          {...props}
        >
          <span className="flex flex-col items-start gap-1">
            <span>{children}</span>
            {description ? (
              <span className="text-xs text-muted-foreground">{description}</span>
            ) : null}
          </span>
        </MenubarPrimitive.Trigger>
      </MenubarPrimitive.Menu>
    );
  }
);

MenuItem.displayName = 'MenuItem';
