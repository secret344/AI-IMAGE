import type { ReactNode } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { VisuallyHidden } from '@/components/ui/visually-hidden';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function SettingsModal({ isOpen, onClose, children }: SettingsModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <VisuallyHidden asChild>
          <DialogTitle>Settings</DialogTitle>
        </VisuallyHidden>
        <VisuallyHidden asChild>
          <DialogDescription>Configure your AI image evaluation settings</DialogDescription>
        </VisuallyHidden>
        {children}
      </DialogContent>
    </Dialog>
  );
}
