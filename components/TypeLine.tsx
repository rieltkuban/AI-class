'use client';

import { useEffect, useState } from 'react';

/**
 * Посимвольная печать одной строки.
 *
 * Компонент ничего не решает сам: печатать или показать сразу — говорит
 * родитель через instant. Так «долистать всё по клику» работает на весь
 * экран, а не на текущую строку.
 */
export function TypeLine({
  text,
  speedMs = 14,
  instant = false,
  onDone,
  className,
}: {
  text: string;
  speedMs?: number;
  instant?: boolean;
  onDone?: () => void;
  className?: string;
}) {
  const [shown, setShown] = useState('');

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (instant || reduced) {
      setShown(text);
      onDone?.();
      return;
    }

    let index = 0;
    setShown('');
    const timer = setInterval(() => {
      index += 1;
      setShown(text.slice(0, index));
      if (index >= text.length) {
        clearInterval(timer);
        onDone?.();
      }
    }, speedMs);

    return () => clearInterval(timer);
    // onDone намеренно вне зависимостей: новая ссылка на каждый рендер
    // родителя перезапускала бы печать с начала.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, speedMs, instant]);

  return (
    <p className={className}>
      {shown}
      {shown.length < text.length && (
        <span
          aria-hidden="true"
          className="ml-0.5 inline-block w-2 animate-pulse bg-[var(--color-term-accent)] text-transparent"
        >
          .
        </span>
      )}
    </p>
  );
}

/**
 * Долистать печать целиком: клик в любом месте или любая клавиша.
 * Возвращает флаг «показывать всё сразу».
 */
export function useSkipTyping(): boolean {
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    if (skipped) return;
    const skip = () => setSkipped(true);
    window.addEventListener('click', skip);
    window.addEventListener('keydown', skip);
    return () => {
      window.removeEventListener('click', skip);
      window.removeEventListener('keydown', skip);
    };
  }, [skipped]);

  return skipped;
}
