'use client';

import { useEffect, useState } from 'react';
import { copy } from '@/content/copy';
import { FRAGMENT_MAX } from '@/lib/sanitize';
import type { Answers } from '@/lib/state';
import { useRunStream, type RunRequest, type TrackState } from '@/lib/useRunStream';

type Level = 'none' | 'figures' | 'fragment';

/** На узком экране вставка фрагмента не предлагается (ТЗ, 4.3). */
function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 639px)');
    const apply = () => setNarrow(query.matches);
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

  return narrow;
}

/** Состояние 3. Живой прогон: два трека одновременно. */
export function Run({ answers, onNext }: { answers: Answers; onNext: () => void }) {
  const narrow = useIsNarrow();
  const { state, start, reset } = useRunStream();
  const [level, setLevel] = useState<Level>('none');
  const [metric, setMetric] = useState('');
  const [period1, setPeriod1] = useState('');
  const [period2, setPeriod2] = useState('');
  const [fragment, setFragment] = useState('');

  const levels: Level[] = narrow ? ['none', 'figures'] : ['none', 'figures', 'fragment'];
  const idle = state.status === 'idle';

  function launch() {
    if (!answers.contour || !answers.cycleDays || answers.revenue === null) return;

    const request: RunRequest = {
      level,
      contour: answers.contour,
      cycleDays: answers.cycleDays,
      revenue: answers.revenue,
    };

    if (level === 'figures') {
      request.figures = {
        metric: metric.trim(),
        period1: Number(period1),
        period2: Number(period2),
      };
    }
    if (level === 'fragment') request.fragment = fragment;

    void start(request);
  }

  const figuresReady =
    metric.trim() !== '' && period1.trim() !== '' && period2.trim() !== '';
  const canLaunch =
    level === 'none' ||
    (level === 'figures' && figuresReady) ||
    (level === 'fragment' && fragment.trim() !== '');

  return (
    <section className="min-h-[60vh]">
      <h2 className="text-lg">{copy.run.heading}</h2>
      <p className="mt-3 max-w-prose text-sm text-[var(--color-term-dim)]">{copy.run.lead}</p>

      {idle && (
        <div className="mt-8">
          <div className="flex flex-col gap-2 sm:flex-row">
            {levels.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setLevel(item)}
                aria-pressed={level === item}
                className={`flex-1 border px-4 py-3 text-sm transition-colors ${
                  level === item
                    ? 'border-[var(--color-term-accent)] text-[var(--color-term-accent)]'
                    : 'border-[var(--color-term-dim)]/40 text-[var(--color-term-dim)]'
                }`}
              >
                {copy.run.levels[item]}
              </button>
            ))}
          </div>

          <p className="mt-3 text-xs text-[var(--color-term-dim)]">{copy.run.levelHint[level]}</p>

          {level === 'figures' && (
            <div className="mt-6 space-y-3">
              <Field
                label={copy.run.figures.metric}
                value={metric}
                onChange={setMetric}
                placeholder={copy.run.figures.metricPlaceholder}
              />
              <div className="flex gap-3">
                <Field
                  label={copy.run.figures.period1}
                  value={period1}
                  onChange={setPeriod1}
                  numeric
                />
                <Field
                  label={copy.run.figures.period2}
                  value={period2}
                  onChange={setPeriod2}
                  numeric
                />
              </div>
            </div>
          )}

          {level === 'fragment' && (
            <div className="mt-6">
              <label className="text-xs text-[var(--color-term-dim)]" htmlFor="fragment">
                {copy.run.fragment.label}
              </label>
              <textarea
                id="fragment"
                rows={6}
                maxLength={FRAGMENT_MAX}
                value={fragment}
                onChange={(event) => setFragment(event.target.value)}
                placeholder={copy.run.fragment.placeholder}
                className="mt-2 w-full border border-[var(--color-term-dim)]/50 bg-transparent p-3 text-sm outline-none focus:border-[var(--color-term-accent)]"
              />
              <p className="mt-1 text-right text-xs text-[var(--color-term-dim)]">
                {copy.run.fragment.counter(fragment.length, FRAGMENT_MAX)}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={launch}
            disabled={!canLaunch}
            className="mt-8 w-full border border-[var(--color-term-accent)] px-6 py-4 text-sm text-[var(--color-term-accent)] disabled:opacity-40 sm:w-auto sm:px-10"
          >
            {copy.run.start}
          </button>
        </div>
      )}

      {state.status === 'rate_limited' && (
        <Notice text={copy.run.rateLimited(state.rateScope)} onNext={onNext} action={copy.run.next} />
      )}

      {state.status === 'failed' && (
        <Notice text={copy.run.failed} onNext={reset} action={copy.run.again} />
      )}

      {(state.status === 'streaming' || state.status === 'finished') && (
        <div className="mt-8">
          <p className="text-xs text-[var(--color-term-dim)]">{copy.run.agentNotice}</p>

          {/* На телефоне треки идут последовательно, не колонками (ТЗ, 13). */}
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <TrackPanel track={state.main} />
            <TrackPanel
              track={state.opponent}
              waitingText={state.opponent.text === '' ? copy.run.waiting : undefined}
            />
          </div>

          {state.divergence !== '' && (
            <div className="mt-8 border-l-2 border-[var(--color-term-accent)] pl-4">
              <p className="text-xs uppercase tracking-wide text-[var(--color-term-accent)]">
                {copy.run.divergence}
              </p>
              <p className="mt-2 text-sm">{state.divergence}</p>
              <p className="mt-3 max-w-prose text-xs leading-relaxed text-[var(--color-term-dim)]">
                {copy.run.divergenceNote}
              </p>
            </div>
          )}

          {state.status === 'finished' && (
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onNext}
                className="border border-[var(--color-term-accent)] px-6 py-4 text-sm text-[var(--color-term-accent)]"
              >
                {copy.run.next}
              </button>
              <button
                type="button"
                onClick={reset}
                className="border border-[var(--color-term-dim)]/50 px-6 py-4 text-sm text-[var(--color-term-dim)]"
              >
                {copy.run.again}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function TrackPanel({ track, waitingText }: { track: TrackState; waitingText?: string }) {
  const reason = track.fallbackReason as keyof typeof copy.run.savedReason | null;

  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-[var(--color-term-dim)]">{track.label}</p>

      <div className="mt-3 min-h-24 whitespace-pre-wrap text-sm leading-relaxed" aria-live="polite">
        {track.text === '' ? (
          <span className="text-[var(--color-term-dim)]">{waitingText ?? '…'}</span>
        ) : (
          track.text
        )}
      </div>

      {reason && (
        <p className="mt-3 text-xs text-[var(--color-term-warn)]">
          {copy.run.savedNotice} {copy.run.savedReason[reason] ?? ''}
        </p>
      )}
    </div>
  );
}

function Notice({
  text,
  onNext,
  action,
}: {
  text: string;
  onNext: () => void;
  action: string;
}) {
  return (
    <div className="mt-8">
      <p className="max-w-prose text-sm leading-relaxed text-[var(--color-term-warn)]">{text}</p>
      <button
        type="button"
        onClick={onNext}
        className="mt-6 border border-[var(--color-term-accent)] px-6 py-4 text-sm text-[var(--color-term-accent)]"
      >
        {action}
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  numeric,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  numeric?: boolean;
}) {
  return (
    <label className="block flex-1">
      <span className="text-xs text-[var(--color-term-dim)]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={numeric ? 'numeric' : undefined}
        autoComplete="off"
        className="mt-1 w-full border border-[var(--color-term-dim)]/50 bg-transparent px-3 py-3 text-sm outline-none focus:border-[var(--color-term-accent)]"
      />
    </label>
  );
}
