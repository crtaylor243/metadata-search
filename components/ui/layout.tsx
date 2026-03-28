import { cn } from '@/lib/utils';
import type { ComponentProps } from 'react';

export function PageShell({ className, ...props }: ComponentProps<'main'>) {
  return (
    <main
      className={cn('mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8', className)}
      {...props}
    />
  );
}

export function Section({ className, ...props }: ComponentProps<'section'>) {
  return <section className={cn('space-y-4 md:space-y-6', className)} {...props} />;
}

export function Stack({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('space-y-3 md:space-y-4', className)} {...props} />;
}

export function Cluster({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-wrap items-center gap-2 md:gap-3', className)} {...props} />;
}
