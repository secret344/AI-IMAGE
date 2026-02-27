import { useTranslation } from 'react-i18next';

interface HistoryEmptyStateProps {
  hasTasks: boolean;
  hasFiltered: boolean;
}

export function HistoryEmptyState({ hasTasks, hasFiltered }: HistoryEmptyStateProps) {
  const { t } = useTranslation();

  if (!hasTasks) {
    return (
      <div className="mt-4 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        {t('history.noHistory')}
      </div>
    );
  }

  if (hasFiltered) {
    return null;
  }

  return <p className="mt-4 text-xs text-muted-foreground">{t('history.noMatches')}</p>;
}
