import { Button } from '@ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@ui/dropdown-menu';
import { getLanguageDisplayName, type LanguageCode } from '@/config/i18n-config';

interface LanguageOption {
  code: LanguageCode;
  name: string;
}

interface LanguageMenuProps {
  currentLanguage: LanguageCode;
  availableLanguages: LanguageOption[];
  onSelectLanguage: (code: LanguageCode) => void;
}

export function LanguageMenu({
  currentLanguage,
  availableLanguages,
  onSelectLanguage
}: LanguageMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <span>{getLanguageDisplayName(currentLanguage)}</span>
          <svg className="ml-2 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {availableLanguages.map(({ code, name }) => (
          <DropdownMenuItem
            key={code}
            onClick={() => onSelectLanguage(code)}
            className={currentLanguage === code ? 'bg-accent' : ''}
          >
            {name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
