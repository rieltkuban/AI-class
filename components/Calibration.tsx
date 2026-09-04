'use client';

import { useState } from 'react';
import { copy } from '@/content/copy';
import { formatRevenueInput, parseRevenue } from '@/lib/format';
import { CALIBRATION_STEPS, type Action, type AppState, type Role } from '@/lib/state';
import { CONTOURS, CYCLE_DAYS, type Contour, type CycleDays } from '@/lib/pricing';

const OPTION_CLASS =
  'w-full border border-[var(--color-term-dim)]/50 px-4 py-4 text-left text-sm transition-colors hover:border-[var(--color-term-accent)] hover:text-[var(--color-term-accent)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--color-term-accent)]';

/** Состояние 1. Четыре вопроса: три кнопками, один — числовым полем. */
export function Calibration({
  state,
  dispatch,
  onSubmit,
}: {
  state: AppState;
  dispatch: (action: Action) => void;
  onSubmit: (revenue: number) => void;
}) {
  const [raw, setRaw] = useState('');
  const [touched, setTouched] = useState(false);
  const revenue = parseRevenue(raw);

  return (
    <section className="min-h-[60vh]">
      <p className="text-xs text-[var(--color-term-dim)]">
        {copy.calibration.progress(state.step + 1, CALIBRATION_STEPS)}
      </p>

      {state.step === 1 && (
        <Question text={copy.calibration.contour.question}>
          {CONTOURS.map((contour: Contour) => (
            <button
              key={contour}
              type="button"
              className={OPTION_CLASS}
              onClick={() => dispatch({ type: 'answer_contour', value: contour })}
            >
              {copy.calibration.contour.options[contour]}
            </button>
          ))}
        </Question>
      )}

      {state.step === 2 && (
        <Question text={copy.calibration.cycle.question}>
          {CYCLE_DAYS.map((days: CycleDays) => (
            <button
              key={days}
              type="button"
              className={OPTION_CLASS}
              onClick={() => dispatch({ type: 'answer_cycle', value: days })}
            >
              {copy.calibration.cycle.options[days]}
            </button>
          ))}
        </Question>
      )}

      {state.step === 0 && (
        <Question text={copy.calibration.role.question}>
          {(Object.keys(copy.calibration.role.options) as Role[]).map((role) => (
            <button
              key={role}
              type="button"
              className={OPTION_CLASS}
              onClick={() => dispatch({ type: 'answer_role', value: role })}
            >
              {copy.calibration.role.options[role]}
            </button>
          ))}
        </Question>
      )}

      {state.step === 3 && (
        <Question text={copy.calibration.revenue.question}>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              setTouched(true);
              if (revenue === null) return;
              dispatch({ type: 'answer_revenue', value: revenue });
              onSubmit(revenue);
            }}
          >
            <input
              autoFocus
              inputMode="numeric"
              autoComplete="off"
              name="revenue"
              aria-label={copy.calibration.revenue.question}
              placeholder={copy.calibration.revenue.placeholder}
              value={raw}
              onChange={(event) => setRaw(formatRevenueInput(event.target.value))}
              className="w-full border border-[var(--color-term-dim)]/50 bg-transparent px-4 py-4 text-lg tabular-nums outline-none focus:border-[var(--color-term-accent)]"
            />
            <p className="text-xs text-[var(--color-term-dim)]">{copy.calibration.revenue.hint}</p>
            {touched && revenue === null && (
              <p className="text-xs text-[var(--color-term-warn)]">{copy.calibration.revenue.empty}</p>
            )}
            <button
              type="submit"
              disabled={state.pending}
              className="w-full border border-[var(--color-term-accent)] px-6 py-4 text-sm text-[var(--color-term-accent)] disabled:opacity-40"
            >
              {copy.calibration.revenue.action}
            </button>
            {state.estimateError && (
              <p className="text-xs text-[var(--color-term-warn)]">{copy.figure.failed}</p>
            )}
          </form>
        </Question>
      )}

      <button
        type="button"
        onClick={() => dispatch({ type: 'back' })}
        className="mt-8 text-xs text-[var(--color-term-dim)] underline underline-offset-4"
      >
        {copy.calibration.back}
      </button>
    </section>
  );
}

function Question({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h2 className="text-base leading-relaxed sm:text-lg">{text}</h2>
      <div className="mt-6 space-y-2">{children}</div>
    </div>
  );
}
