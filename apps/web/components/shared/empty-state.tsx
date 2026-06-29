import type { ReactNode } from 'react';

export function EmptyState({
  icon,
  message,
  action,
}: {
  icon?: ReactNode;
  message: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
      {icon}
      <p className="text-sm text-muted-foreground">{message}</p>
      {action}
    </div>
  );
}
