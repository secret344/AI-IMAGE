import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { FilterConfig, FilterState } from './historyUtils';

interface HistoryFiltersProps {
  query: string;
  sortMode: 'time' | 'score';
  filterState: FilterState;
  filterConfigs: FilterConfig[];
  onQueryChange: (value: string) => void;
  onSortChange: (value: 'time' | 'score') => void;
  onToggleFilter: (key: keyof FilterState, checked: boolean) => void;
}

export function HistoryFilters({
  query,
  sortMode,
  filterState,
  filterConfigs,
  onQueryChange,
  onSortChange,
  onToggleFilter
}: HistoryFiltersProps) {
  const { t } = useTranslation();

  return (
    <>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          className="flex-1"
          placeholder={t('history.search')}
        />
        <Select value={sortMode} onValueChange={(value) => onSortChange(value as 'time' | 'score')}>
          <SelectTrigger className="w-auto min-w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="time">{t('history.sortByTime')}</SelectItem>
            <SelectItem value="score">{t('history.sortByScore')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
        {filterConfigs.map(({ key, label }) => (
          <Label key={key} className="flex items-center gap-2 cursor-pointer font-normal">
            <Checkbox
              checked={filterState[key]}
              onCheckedChange={(checked) => onToggleFilter(key, checked as boolean)}
            />
            {label}
          </Label>
        ))}
      </div>
    </>
  );
}
