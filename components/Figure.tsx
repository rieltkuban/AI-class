'use client';

import { useState } from 'react';
import { copy } from '@/content/copy';
import { formatRub } from '@/lib/format';
import { revenueBand, type EstimateResult } from '@/lib/pricing';
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

  const contour = answers.contour ? copy.calibration.contour.options[answers.contour] : '';
  const cycle = answers.cycleDays ? copy.calibration.cycle.options[answers.cycleDays] : '';
  const band = answers.revenue !== null ? revenueBand(answers.revenue) : '';
  const b = estimate.breakdown!;

  return (
    <section className="min-h-[60vh]" aria-live="polite">
      <TypeLine
        text={copy.figure.computing}
        instant={skipped}
        onDone={() => setStep((s) => Math.max(s, 1))}
      />

      {step >= 1 && (
        <TypeLine
          className="mt-4 text-sm text-[var(--color-term-dim)]"
          text={copy.figure.context(contour, cycle, band)}
          instant={skipped}
          onDone={() => setStep((s) => Math.max(s, 2))}
        />
      )}

      {step >= 2 && (
        <div className="mt-10">
          <p className="text-sm text-[var(--color-term-dim)]">{copy.figure.dayLead}</p>
          {estimate.dayBelowRounding ? (
            <p className="mt-2 text-xl text-[var(--color-term-warn)]">
              {copy.figure.dayBelowRounding}
            </p>
          ) : (
            <p className="mt-2 text-4xl tabular-nums text-[var(--color-term-accent)] sm:text-5xl">
              {formatRub(estimate.day!)}
            </p>
          )}

          <p className="mt-6 text-sm">
            {estimate.year === 0
              ? copy.figure.yearZero
              : copy.figure.yearLead(formatRub(estimate.year!))}
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
