import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export function EmptyState({
  title,
  description,
  icon,
  className,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-lg border border-dashed p-8 text-center', className)} role="status" aria-live="polite">
      {icon ? <div className="mb-3 flex justify-center text-muted-foreground">{icon}</div> : null}
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
