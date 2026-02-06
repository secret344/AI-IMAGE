export interface TaskItemActionConfig {
  label: string;
  variant: 'default' | 'primary' | 'danger';
  handler: () => void | Promise<void>;
}
