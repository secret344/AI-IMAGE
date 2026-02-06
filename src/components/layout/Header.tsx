import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  title: string;
  subtitle: string;
  badge: string;
  settingsLabel: string;
  modelInfo: string;
  onOpenSettings: () => void;
  languageMenu: ReactNode;
}

export function Header({
  title,
  subtitle,
  badge,
  settingsLabel,
  modelInfo,
  onOpenSettings,
  languageMenu
}: HeaderProps) {
  return (
    <header className="border-b border-border/50 px-4 sm:px-6 py-4 sm:py-6 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm uppercase tracking-widest text-muted-foreground font-medium">
            {title}
          </p>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground mt-1">{subtitle}</h1>
        </div>
        <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
          <div className="hidden sm:block text-xs text-muted-foreground/70 text-right">{badge}</div>
          <Button
            onClick={onOpenSettings}
            variant="outline"
            size="sm"
            className="flex items-center gap-2 h-9 px-3"
            aria-label="Settings"
          >
            <svg
              className="h-4 w-4 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <div className="hidden sm:flex flex-col items-start text-left">
              <span className="text-xs font-medium">{settingsLabel}</span>
              <span className="text-[10px] text-muted-foreground">{modelInfo}</span>
            </div>
          </Button>
          {languageMenu}
        </div>
      </div>
    </header>
  );
}
