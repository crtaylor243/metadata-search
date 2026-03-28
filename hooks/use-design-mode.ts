'use client';

import { useEffect, useState } from 'react';
import type { DesignMode } from '@/components/design-mode-toggle';

const STORAGE_KEY = 'discography-design-mode';

export function useDesignMode() {
  const [mode, setMode] = useState<DesignMode>('new');

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as DesignMode | null;
    if (stored === 'classic' || stored === 'new') {
      setMode(stored);
    }
  }, []);

  const updateMode = (nextMode: DesignMode) => {
    setMode(nextMode);
    window.localStorage.setItem(STORAGE_KEY, nextMode);
  };

  return { mode, setMode: updateMode, isRedesignEnabled: mode === 'new' };
}
