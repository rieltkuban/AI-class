'use client';

import { copy } from '@/content/copy';

/** Быстрый путь: неброская строка в правом верхнем углу на каждом экране. */
export function SkipLink({ onSkip }: { onSkip: () => void }) {
  return (
    <button
      type="button"
      onClick={onSkip}
      className="absolute right-4 top-4 text-xs text-[var(--color-term-dim)] underline underline-offset-4 transition-colors hover:text-[var(--color-term-fg)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--color-term-accent)]"
    >
      {copy.skip.label}
    </button>
  );
}
