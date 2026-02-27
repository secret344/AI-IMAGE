import type { ReactNode } from 'react';
import { Label } from '@ui/label';

interface FieldRowProps {
  label: string;
  children: ReactNode;
}

export function FieldRow({ label, children }: FieldRowProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
