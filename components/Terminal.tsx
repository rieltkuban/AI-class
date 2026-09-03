'use client';

import { useState } from 'react';
import { copy } from '@/content/copy';
import { TypeLine, useSkipTyping } from './TypeLine';

/** Состояние 0. Печать трёх строк, захват за восемь секунд. */
export function Terminal({ onStart }: { onStart: () => void }) {
  const skipped = useSkipTyping();
  const [typed, setTyped] = useState(0);
  const lines = copy.terminal.lines;

  const visible = skipped ? lines.length : Math.min(typed + 1, lines.length);
  const ready = skipped || typed >= lines.length;

  return (
    <section className="min-h-[60vh]">
      <div className="space-y-3 text-base leading-relaxed sm:text-lg" aria-live="polite">
        {lines.slice(0, visible).map((line, index) => (
          <TypeLine
            key={line}
            text={line}
            instant={skipped}
            onDone={() => setTyped((done) => Math.max(done, index + 1))}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={onStart}
        disabled={!ready}
        className="mt-10 w-full border border-[var(--color-term-accent)] px-6 py-4 text-sm text-[var(--color-term-accent)] transition-opacity disabled:opacity-0 sm:w-auto sm:px-8"
      >
        {copy.terminal.action}
      </button>
    </section>
  );
}
