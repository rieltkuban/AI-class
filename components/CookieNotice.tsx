'use client';

import { useEffect, useState } from 'react';

const KEY = 'aiclass.cookies.v1';

/** Уведомление о cookies. Показывается только при подключённой Метрике. */
export function CookieNotice({ enabled }: { enabled: boolean }) {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (!enabled) return;
    try {
      setHidden(window.localStorage.getItem(KEY) === 'ok');
    } catch {
      setHidden(false);
    }
  }, [enabled]);

  if (!enabled || hidden) return null;

  function accept() {
    try {
      window.localStorage.setItem(KEY, 'ok');
    } catch {
      // Не смогли запомнить — покажем ещё раз, это не поломка.
    }
    setHidden(true);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-[var(--color-term-dim)]/30 bg-[var(--color-term-bg)]/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-2xl flex-col gap-3 text-xs text-[var(--color-term-dim)] sm:flex-row sm:items-center sm:justify-between">
        <p>
          Сайт использует cookies и счётчик посещений.{' '}
          <a href="/privacy" className="underline underline-offset-4">
            Подробнее
          </a>
        </p>
        <button
          type="button"
          onClick={accept}
          className="shrink-0 border border-[var(--color-term-dim)]/50 px-4 py-2 text-[var(--color-term-fg)]"
        >
          Понятно
        </button>
      </div>
    </div>
  );
}
