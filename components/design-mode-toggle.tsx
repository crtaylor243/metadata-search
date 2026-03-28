'use client';

import { Button } from '@/components/ui/button';
import { Cluster } from '@/components/ui/layout';

export type DesignMode = 'classic' | 'new';

export function DesignModeToggle({ mode, onChange }: { mode: DesignMode; onChange: (mode: DesignMode) => void }) {
  return (
    <Cluster className="rounded-lg border p-1" role="tablist" aria-label="Design mode">
      <Button
        size="sm"
        variant={mode === 'classic' ? 'default' : 'ghost'}
        role="tab"
        aria-selected={mode === 'classic'}
        onClick={() => onChange('classic')}
      >
        Classic
      </Button>
      <Button
        size="sm"
        variant={mode === 'new' ? 'default' : 'ghost'}
        role="tab"
        aria-selected={mode === 'new'}
        onClick={() => onChange('new')}
      >
        New
      </Button>
    </Cluster>
  );
}
