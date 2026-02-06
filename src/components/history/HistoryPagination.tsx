import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

interface HistoryPaginationProps {
  page: number;
  totalPages: number;
  onPrevious: () => void;
  onNext: () => void;
}

export function HistoryPagination({
  page,
  totalPages,
  onPrevious,
  onNext
}: HistoryPaginationProps) {
  const { t } = useTranslation();

  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
      <Button variant="outline" size="sm" onClick={onPrevious} disabled={page === 1}>
        {t('history.previous')}
      </Button>
      <span>
        {page} / {totalPages}
      </span>
      <Button variant="outline" size="sm" onClick={onNext} disabled={page === totalPages}>
        {t('history.next')}
      </Button>
    </div>
  );
}
