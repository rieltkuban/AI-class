'use client';

import { useReducer } from 'react';
import { Calibration } from '@/components/Calibration';
import { Figure } from '@/components/Figure';
import { SkipLink } from '@/components/SkipLink';
import { Terminal } from '@/components/Terminal';
import { copy } from '@/content/copy';
import type { EstimateResult } from '@/lib/pricing';
import { initialState, reducer } from '@/lib/state';

/**
 * Единственная страница. Семь состояний, без меню, URL не меняется (ТЗ, 4.1).
 * Готовы состояния 0–2 и ветка «решение принимаю не я».
 * Состояния 3–6 подключаются на следующих этапах.
 */
export default function Page() {
  const [state, dispatch] = useReducer(reducer, initialState);

  async function runEstimate(revenue: number) {
    dispatch({ type: 'estimate_pending' });
    try {
      const response = await fetch('/api/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contour: state.answers.contour,
          cycleDays: state.answers.cycleDays,
          revenue,
        }),
      });
      if (!response.ok) throw new Error('estimate failed');
      const result = (await response.json()) as EstimateResult;
      dispatch({ type: 'estimate_done', value: result });
    } catch {
      dispatch({ type: 'estimate_failed' });
    }
  }

  return (
    <main className="relative mx-auto min-h-dvh max-w-2xl px-4 pb-16 pt-16 sm:px-6">
      <h1 className="sr-only">ИИ-Академия</h1>

      {state.screen !== 'admission' && <SkipLink onSkip={() => dispatch({ type: 'skip' })} />}

      {state.screen === 'terminal' && <Terminal onStart={() => dispatch({ type: 'start' })} />}

      {state.screen === 'calibration' && (
        <Calibration state={state} dispatch={dispatch} onSubmit={runEstimate} />
      )}

      {state.screen === 'figure' && state.estimate && (
        <Figure
          answers={state.answers}
          estimate={state.estimate}
          onNext={() => dispatch({ type: 'goto', screen: 'run' })}
          onRetry={() => dispatch({ type: 'restart_calibration' })}
        />
      )}

      {state.screen === 'bystander' && (
        <section className="min-h-[60vh]">
          <h2 className="text-lg">{copy.bystander.heading}</h2>
          {copy.bystander.body.map((line) => (
            <p key={line} className="mt-4 max-w-prose text-sm leading-relaxed">
              {line}
            </p>
          ))}
          <button
            type="button"
            onClick={() => dispatch({ type: 'goto', screen: 'admission' })}
            className="mt-8 w-full border border-[var(--color-term-accent)] px-6 py-4 text-sm text-[var(--color-term-accent)] sm:w-auto"
          >
            {copy.bystander.action}
          </button>
        </section>
      )}

      {(state.screen === 'run' ||
        state.screen === 'construction' ||
        state.screen === 'admission' ||
        state.screen === 'return') && (
        <section className="min-h-[60vh]">
          <p className="text-sm text-[var(--color-term-dim)]">
            Экран «{state.screen}» подключается на следующем этапе.
          </p>
        </section>
      )}

      <footer className="mt-16 border-t border-[var(--color-term-dim)]/20 pt-6 text-xs text-[var(--color-term-dim)]">
        <a href="/privacy" className="underline underline-offset-4">
          {copy.footer.privacy}
        </a>
      </footer>
    </main>
  );
}
