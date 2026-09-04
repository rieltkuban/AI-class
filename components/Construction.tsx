'use client';

import { copy } from '@/content/copy';

/** Состояние 4. Разбор конструкции: четыре роли, каждая делает одну вещь. */
export function Construction({ onNext }: { onNext: () => void }) {
  return (
    <section className="min-h-[60vh]">
      <h2 className="text-lg">{copy.construction.heading}</h2>
      {copy.construction.lead.map((line) => (
        <p key={line} className="mt-3 max-w-prose text-sm leading-relaxed">
          {line}
        </p>
      ))}

      <ol className="mt-8 space-y-0">
        {copy.construction.roles.map((role, index) => (
          <li key={role.title} className="relative border-l border-[var(--color-term-dim)]/30 pb-8 pl-6">
            <span className="absolute -left-[7px] top-1 block h-3 w-3 border border-[var(--color-term-accent)] bg-[var(--color-term-bg)]" />
            <p className="text-xs text-[var(--color-term-dim)]">Роль {index + 1}</p>
            <p className="mt-1 text-sm text-[var(--color-term-accent)]">{role.title}</p>
            <p className="mt-2 max-w-prose text-sm leading-relaxed">{role.body}</p>
          </li>
        ))}
      </ol>

      <p className="max-w-prose text-sm leading-relaxed">{copy.construction.nightNote}</p>

      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-[var(--color-term-accent)] underline underline-offset-4">
          {copy.construction.morningLink}
        </summary>
        <p className="mt-3 max-w-prose whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-term-dim)]">
          {copy.construction.morningPlaceholder}
        </p>
      </details>

      <p className="mt-8 max-w-prose border-l-2 border-[var(--color-term-dim)]/40 pl-4 text-xs leading-relaxed text-[var(--color-term-dim)]">
        {copy.construction.calcNote}
      </p>

      <button
        type="button"
        onClick={onNext}
        className="mt-10 w-full border border-[var(--color-term-accent)] px-6 py-4 text-sm text-[var(--color-term-accent)] sm:w-auto sm:px-10"
      >
        {copy.construction.next}
      </button>
    </section>
  );
}
