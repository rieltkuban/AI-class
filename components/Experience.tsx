'use client';

import { useEffect, useReducer, useRef } from 'react';
import { Admission } from '@/components/Admission';
import { Calibration } from '@/components/Calibration';
import { Construction } from '@/components/Construction';
import { Figure } from '@/components/Figure';
import { Run } from '@/components/Run';
import { SkipLink } from '@/components/SkipLink';
import { Terminal } from '@/components/Terminal';
import { copy } from '@/content/copy';
import { track, trackLeaving } from '@/lib/analytics';
import { isContour, type EstimateResult } from '@/lib/pricing';
import { initialState, reducer, type Screen } from '@/lib/state';
import { formatVisitDate, readVisit, writeVisit } from '@/lib/visit';

/**
 * Машина состояний страницы (ТЗ, 4.1). Семь состояний, без меню,
 * URL не меняется. Переход — ответ системы на действие посетителя.
 *
 * В режиме teaser живой прогон и конструкция скрыты: с экрана цены суток
 * посетитель идёт сразу к форме (ТЗ, 1.4).
 */
export function Experience({ full }: { full: boolean }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const skipUsed = useRef(false);
  const screenRef = useRef<Screen>(state.screen);
  screenRef.current = state.screen;

  // Повторный визит: читаем метку и предлагаем другой сценарий.
  useEffect(() => {
    const visit = readVisit();
    if (visit) dispatch({ type: 'mark_returning' });
  }, []);

  // «Задержался на первом экране» и точка отвала.
  useEffect(() => {
    const stay = setTimeout(() => track('stay_10s'), 10_000);
    const leave = () => trackLeaving('drop_off', { screen: screenRef.current });
    window.addEventListener('pagehide', leave);
    return () => {
      clearTimeout(stay);
      window.removeEventListener('pagehide', leave);
    };
  }, []);

  useEffect(() => {
    if (state.screen === 'construction') track('construction_shown');
    if (state.screen === 'run') track('run_started', { contour: state.answers.contour ?? undefined });
  }, [state.screen, state.answers.contour]);

  async function runEstimate(revenue: number) {
    track('calibration_done', { contour: state.answers.contour ?? undefined });
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
      track('figure_shown', { contour: state.answers.contour ?? undefined });
      if (state.answers.contour) writeVisit(state.answers.contour);
    } catch {
      dispatch({ type: 'estimate_failed' });
    }
  }

  function skip() {
    skipUsed.current = true;
    track('skip_used');
    dispatch({ type: 'skip' });
  }

  /** После цены суток: в полном режиме — прогон, в тизере — сразу форма. */
  const afterFigure: Screen = full ? 'run' : 'admission';
  const visit = state.returning ? readVisit() : null;

  return (
    <main className="relative mx-auto min-h-dvh max-w-2xl px-4 pb-24 pt-16 sm:px-6">
      <h1 className="sr-only">ИИ-Академия</h1>

      {state.screen !== 'admission' && <SkipLink onSkip={skip} />}

      {state.screen === 'terminal' && (
        <>
          <Terminal onStart={() => dispatch({ type: 'start' })} />
          {visit && (
            <div className="mt-10 border-t border-[var(--color-term-dim)]/20 pt-6">
              <p className="text-xs text-[var(--color-term-dim)]">
                {copy.returnVisit.heading}.{' '}
                {copy.returnVisit.body(
                  formatVisitDate(visit.at),
                  isContour(visit.contour)
                    ? copy.calibration.contour.options[visit.contour]
                    : visit.contour,
                )}
              </p>
              <button
                type="button"
                onClick={() => dispatch({ type: 'goto', screen: 'admission' })}
                className="mt-3 text-xs text-[var(--color-term-accent)] underline underline-offset-4"
              >
                {copy.returnVisit.toAdmission}
              </button>
            </div>
          )}
        </>
      )}

      {state.screen === 'calibration' && (
        <Calibration state={state} dispatch={dispatch} onSubmit={runEstimate} />
      )}

      {state.screen === 'figure' && state.estimate && (
        <Figure
          answers={state.answers}
          estimate={state.estimate}
          onNext={() => dispatch({ type: 'goto', screen: afterFigure })}
          onRetry={() => dispatch({ type: 'restart_calibration' })}
        />
      )}

      {state.screen === 'run' && full && (
        <Run
          answers={state.answers}
          onNext={() => dispatch({ type: 'goto', screen: 'construction' })}
        />
      )}

      {state.screen === 'construction' && full && (
        <Construction onNext={() => dispatch({ type: 'goto', screen: 'admission' })} />
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
            className="mt-8 w-full border border-[var(--color-term-accent)] px-6 py-4 text-sm text-[var(--color-term-accent)] sm:w-auto sm:px-10"
          >
            {copy.bystander.action}
          </button>
        </section>
      )}

      {state.screen === 'admission' && (
        <Admission
          answers={state.answers}
          dayCost={state.estimate?.day ?? null}
          source={skipUsed.current ? 'быстрый путь' : 'полный путь'}
        />
      )}

      <footer className="mt-16 border-t border-[var(--color-term-dim)]/20 pt-6 text-xs text-[var(--color-term-dim)]">
        <a href="/privacy" className="underline underline-offset-4">
          {copy.footer.privacy}
        </a>
      </footer>
    </main>
  );
}
