'use client';

import { useState } from 'react';
import { copy, CONTOUR_INLINE, CYCLE_INLINE } from '@/content/copy';
import { formatBigRub, formatRub, plural } from '@/lib/format';
import type { EstimateResult } from '@/lib/pricing';
import type { Answers } from '@/lib/state';
import { TypeLine, useSkipTyping } from './TypeLine';

/** Состояние 2. Детерминированный расчёт, печатается построчно. */
export function Figure({
  answers,
  estimate,
  onNext,
  onRetry,
}: {
  answers: Answers;
  estimate: EstimateResult;
  onNext: () => void;
  onRetry: () => void;
}) {
  const [formulaOpen, setFormulaOpen] = useState(false);
  const [step, setStep] = useState(0);
  const skipped = useSkipTyping();

  if (estimate.status === 'below_scale') {
    return (
      <Refusal text={copy.figure.belowScale} action={copy.figure.retry} onAction={onRetry} />
    );
  }
  if (estimate.status === 'suspicious_scale') {
    return (
      <Refusal text={copy.figure.suspiciousScale} action={copy.figure.retry} onAction={onRetry} />
    );
  }

  const contour = answers.contour ? CONTOUR_INLINE[answers.contour] : '';
  const cycle = answers.cycleDays ? CYCLE_INLINE[answers.cycleDays] : '';
  const b = estimate.breakdown!;

  // «За год это 34 решения × 6 избыточных суток = 69 млн ₽ неоптимальных.»
  const decisions = `${b.n} ${plural(b.n, 'решение', 'решения', 'решений')}`;

  // Сумму показываем крупно отдельной строкой, поэтому из выверенной фразы
  // берём только её начало — до места подстановки.
  const dayLine = copy.figure.day('\u00a7');
  const dayLead = dayLine.slice(0, dayLine.indexOf('\u00a7')).trimEnd();
  const excess = `${b.excessDays} ${plural(b.excessDays, 'избыточные сутки', 'избыточных суток', 'избыточных суток')}`;

  return (
    <section className="min-h-[60vh]" aria-live="polite">
      <TypeLine
        text={copy.figure.computing(contour, cycle)}
        instant={skipped}
        onDone={() => setStep((s) => Math.max(s, 2))}
      />

      {step >= 2 && (
        <div className="mt-10">
          {estimate.dayBelowRounding ? (
            <p className="text-xl text-[var(--color-term-warn)]">
              {copy.figure.dayBelowRounding}
            </p>
          ) : (
            <>
              <p className="max-w-prose text-sm text-[var(--color-term-dim)]">
                {dayLead}
              </p>
              <p className="mt-2 text-4xl tabular-nums text-[var(--color-term-accent)] sm:text-5xl">
                {formatRub(estimate.day!)}
              </p>
            </>
          )}

          <p className="mt-6 max-w-prose text-sm leading-relaxed">
            {estimate.year === 0
              ? copy.figure.yearZero
              : copy.figure.year(decisions, excess, formatBigRub(estimate.year!))}
          </p>
          {estimate.capped && (
            <p className="mt-2 text-xs text-[var(--color-term-warn)]">{copy.figure.capped}</p>
          )}

          <button
            type="button"
            onClick={() => setFormulaOpen((open) => !open)}
            aria-expanded={formulaOpen}
            className="mt-6 text-xs text-[var(--color-term-dim)] underline underline-offset-4"
          >
            {formulaOpen ? copy.figure.formulaHide : copy.figure.formulaToggle}
          </button>

          {/* tabIndex: блок с горизонтальной прокруткой должен быть доступен с клавиатуры. */}
          {formulaOpen && (
            <pre
              tabIndex={0}
              aria-label="Расчёт с подставленными значениями"
              className="mt-4 overflow-x-auto border border-[var(--color-term-dim)]/40 p-4 text-xs leading-relaxed text-[var(--color-term-dim)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--color-term-accent)]"
            >
{`зона влияния контура      k = ${String(b.k).replace('.', ',')}
решений в год             N = ${b.n}
потеря за сутки           p = ${(b.p * 100).toFixed(1).replace('.', ',')}%

выручка на одно решение   V = выручка × k / N = ${formatRub(Math.round(b.perDecision))}
цена суток                    V × p = ${formatRub(Math.round(b.rawDay))}
избыточные сутки              цикл − 1 = ${b.excessDays}
за год                        цена суток × ${b.excessDays} × ${b.n} = ${formatRub(Math.round(b.rawYear))}`}
            </pre>
          )}

          <p className="mt-6 max-w-prose text-xs leading-relaxed text-[var(--color-term-dim)]">
            {copy.figure.disclaimer}
          </p>

          <button
            type="button"
            onClick={onNext}
            className="mt-10 w-full border border-[var(--color-term-accent)] px-6 py-4 text-sm text-[var(--color-term-accent)] sm:w-auto"
          >
            {copy.figure.next}
          </button>
        </div>
      )}
    </section>
  );
}

function Refusal({
  text,
  action,
  onAction,
}: {
  text: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <section className="min-h-[60vh]" aria-live="polite">
      <p className="max-w-prose text-base leading-relaxed">{text}</p>
      <button
        type="button"
        onClick={onAction}
        className="mt-8 border border-[var(--color-term-dim)] px-6 py-3 text-sm"
      >
        {action}
      </button>
    </section>
  );
}
