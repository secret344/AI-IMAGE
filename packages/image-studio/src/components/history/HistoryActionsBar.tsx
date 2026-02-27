import { useTranslation } from 'react-i18next';
import { Button } from '@ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';

interface HistoryActionsBarProps {
  filteredCount: number;
  page: number;
  totalPages: number;
  selectedCount: number;
  pagedCount?: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onExportFilteredJson: () => void;
  onExportCurrentPage: () => void;
  onExportZip: () => void;
  onExportXmp: () => void;
  onDeleteSelected: () => void;
}

export function HistoryActionsBar({
  filteredCount,
  page,
  totalPages,
  selectedCount,
  pagedCount = 0,
  onSelectAll,
  onClearSelection,
  onExportFilteredJson,
  onExportCurrentPage,
  onExportZip,
  onExportXmp,
  onDeleteSelected
}: HistoryActionsBarProps) {
  const { t } = useTranslation();

  if (filteredCount === 0) {
    return null;
  }

  return (
    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border/50 bg-card/60 p-4 shadow-sm">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground text-base">{filteredCount}</span>
        <span>{t('history.items')}</span>
        <span className="text-border">·</span>
        <span className="text-xs text-muted-foreground/70">
          {t('history.page')}{' '}
          <span className="font-medium">
            {page}/{totalPages}
          </span>
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={onSelectAll}
          className="h-8 px-3 text-xs font-medium"
        >
          {t('history.selectAll')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onClearSelection}
          className="h-8 px-3 text-xs font-medium"
          disabled={selectedCount === 0}
        >
          {t('history.clear')}
        </Button>

        <div className="hidden sm:block w-px h-6 bg-border/50" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs font-medium transition-colors hover:bg-primary/10"
            >
              {t('history.export')}
              <ChevronDown className="ml-1.5 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuItem
              onClick={onExportZip}
              disabled={selectedCount === 0}
              className="cursor-pointer"
            >
              <div className="flex flex-1 items-center justify-between gap-3">
                <span>{t('history.exportZip')}</span>
                <span className="text-xs text-muted-foreground/70 ml-2 font-medium">
                  ({selectedCount})
                </span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onExportXmp}
              disabled={selectedCount === 0}
              className="cursor-pointer"
            >
              <div className="flex flex-1 items-center justify-between gap-3">
                <span>{t('history.exportXmp')}</span>
                <span className="text-xs text-muted-foreground/70 ml-2 font-medium">
                  ({selectedCount})
                </span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onExportCurrentPage} className="cursor-pointer">
              <div className="flex flex-1 items-center justify-between gap-3">
                <span>{t('history.exportCurrentPage')}</span>
                <span className="text-xs text-muted-foreground/70 ml-2 font-medium">
                  ({pagedCount})
                </span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExportFilteredJson} className="cursor-pointer">
              <div className="flex flex-1 items-center justify-between gap-3">
                <span>{t('history.exportFiltered')}</span>
                <span className="text-xs text-muted-foreground/70 ml-2 font-medium">
                  ({filteredCount})
                </span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="destructive"
          size="sm"
          onClick={onDeleteSelected}
          disabled={selectedCount === 0}
          className="h-8 px-3 text-xs font-medium transition-all"
        >
          {t('history.delete')} ({selectedCount})
        </Button>
      </div>
    </div>
  );
}
