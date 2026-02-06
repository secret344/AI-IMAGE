import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import type { Theme } from '@/hooks/useTheme';

interface ThemeOption {
  id: Theme;
  label: string;
  description: string;
  icon: React.ReactNode;
}

interface ThemeMenuProps {
  currentTheme: Theme;
  onSelectTheme: (theme: Theme) => void;
}

export function ThemeMenu({ currentTheme, onSelectTheme }: ThemeMenuProps) {
  const themeOptions: ThemeOption[] = [
    {
      id: 'light',
      label: 'Light',
      description: '浅色模式',
      icon: (
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m5.08 5.08l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m5.08-5.08l4.24-4.24" />
        </svg>
      )
    },
    {
      id: 'dark',
      label: 'Dark',
      description: '深色模式',
      icon: (
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )
    },
    {
      id: 'system',
      label: 'System',
      description: '跟随系统',
      icon: (
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <path d="M8 21h8M12 17v4" strokeWidth="2" stroke="currentColor" fill="none" />
        </svg>
      )
    }
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Theme">
          {currentTheme === 'light' && (
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="5" />
              <path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m5.08 5.08l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m5.08-5.08l4.24-4.24" />
            </svg>
          )}
          {currentTheme === 'dark' && (
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
          {currentTheme === 'system' && (
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <path d="M8 21h8M12 17v4" strokeWidth="2" stroke="currentColor" fill="none" />
            </svg>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {themeOptions.map(({ id, label, description, icon }) => (
          <DropdownMenuItem
            key={id}
            onClick={() => onSelectTheme(id)}
            className={`flex items-start gap-3 cursor-pointer ${currentTheme === id ? 'bg-accent' : ''}`}
          >
            <div className="flex items-center justify-center mt-1">{icon}</div>
            <div className="flex-1">
              <div className="font-medium text-sm">{label}</div>
              <div className="text-xs text-muted-foreground">{description}</div>
            </div>
            {currentTheme === id && (
              <svg
                className="h-4 w-4 text-primary flex-shrink-0 mt-1"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M20.285 2l-11.285 11.567-5.286-5.011-3.714 3.716 9 8.728 15-15.285z" />
              </svg>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
