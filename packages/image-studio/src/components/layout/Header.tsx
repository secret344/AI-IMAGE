import type { ReactNode } from 'react';
import { Button } from '@ui/button';

interface HeaderProps {
  title: string;
  subtitle: string;
  badge: string;
  settingsLabel: string;
  modelInfo: string;
  onOpenSettings: () => void;
  languageMenu: ReactNode;
  hostBackButton?: ReactNode;
}

export function Header({
  title,
  subtitle,
  badge,
  settingsLabel,
  modelInfo,
  onOpenSettings,
  languageMenu,
  hostBackButton
}: HeaderProps) {
  return (
    <header className="border-b border-border/40 px-4 sm:px-6 py-4 sm:py-6 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex items-center justify-between gap-4 px-1">
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm uppercase tracking-[0.2em] text-muted-foreground font-medium">
            {title}
          </p>
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground mt-1">{subtitle}</h1>
        </div>
        <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
          {hostBackButton}
          <div className="hidden sm:block rounded-full border border-border/50 bg-card/60 px-3 py-1 text-[11px] text-muted-foreground">
            {badge}
          </div>
          <Button
            onClick={onOpenSettings}
            variant="outline"
            size="sm"
            className="flex items-center gap-2 h-9 px-3 border-border/60 bg-card/40 hover:bg-card/70"
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
              <span className="text-[10px] text-muted-foreground line-clamp-1 max-w-[180px]">
                {modelInfo}
              </span>
            </div>
          </Button>
          {languageMenu}
        </div>
      </div>
    </header>
  );
}
