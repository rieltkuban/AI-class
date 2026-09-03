'use client';

import { useEffect, useState } from 'react';
import { copy } from '@/content/copy';
import { track } from '@/lib/analytics';
import { formatRub } from '@/lib/format';
import { revenueBand } from '@/lib/pricing';
import type { Answers } from '@/lib/state';

interface Stats {
  seatsTotal: number;
  seatsTaken: number;
  admissionOpen: boolean;
  launchDate: string;
}

/** Состояние 5. Заявка на поток и счётчик мест. */
export function Admission({ answers, source }: { answers: Answers; source: string }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [contact, setContact] = useState('');
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/stats')
      .then((response) => (response.ok ? response.json() : null))
      .then((data: Stats | null) => {
        if (!cancelled && data) setStats(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const contactValid = contact.trim().length >= 3;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!contactValid || !consent) return;

    setStatus('sending');
    try {
      const response = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact: contact.trim(),
          name: name.trim(),
          comment: comment.trim(),
          consent: true,
          contour: answers.contour ? copy.calibration.contour.options[answers.contour] : '',
          cycle: answers.cycleDays ? copy.calibration.cycle.options[answers.cycleDays] : '',
          role: answers.role ? copy.calibration.role.options[answers.role] : '',
          // Точное число не отправляем никогда — только порядок величины.
          revenueBand: answers.revenue !== null ? revenueBand(answers.revenue) : '',
          source,
        }),
      });
      if (!response.ok) throw new Error('lead failed');
      setStatus('sent');
      track('lead_submitted', { contour: answers.contour ?? undefined });
    } catch {
      setStatus('failed');
    }
  }

  if (status === 'sent') {
    return (
      <section className="min-h-[60vh]">
        <h2 className="text-lg text-[var(--color-term-accent)]">{copy.admission.sent}</h2>
      </section>
    );
  }

  return (
    <section className="min-h-[60vh]">
      <h2 className="text-lg">{copy.admission.heading}</h2>
      <p className="mt-3 max-w-prose text-sm text-[var(--color-term-dim)]">{copy.admission.lead}</p>

      {stats && (
        <div className="mt-6 text-sm tabular-nums">
          {stats.admissionOpen ? (
            <p className="text-[var(--color-term-accent)]">
              {copy.admission.seats(stats.seatsTaken, stats.seatsTotal)}
            </p>
          ) : (
            <p className="text-[var(--color-term-warn)]">{copy.admission.seatsClosed}</p>
          )}
          {stats.launchDate !== '' && (
            <p className="mt-1 text-xs text-[var(--color-term-dim)]">
              {copy.admission.launch(stats.launchDate)}
            </p>
          )}
        </div>
      )}

      {answers.revenue !== null && (
        <p className="mt-6 text-xs text-[var(--color-term-dim)]">
          {`Ваш контур: ${
            answers.contour ? copy.calibration.contour.options[answers.contour] : '—'
          }. Порядок выручки: ${revenueBand(answers.revenue)}.`}
        </p>
      )}

      <form className="mt-8 space-y-4" onSubmit={submit} noValidate>
        <label className="block">
          <span className="text-xs text-[var(--color-term-dim)]">{copy.admission.contact.label}</span>
          <input
            required
            value={contact}
            onChange={(event) => setContact(event.target.value)}
            placeholder={copy.admission.contact.placeholder}
            autoComplete="tel"
            className="mt-1 w-full border border-[var(--color-term-dim)]/50 bg-transparent px-4 py-4 text-sm outline-none focus:border-[var(--color-term-accent)]"
          />
        </label>
        {touched && !contactValid && (
          <p className="text-xs text-[var(--color-term-warn)]">{copy.admission.contactRequired}</p>
        )}

        <label className="block">
          <span className="text-xs text-[var(--color-term-dim)]">{copy.admission.contact.name}</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={copy.admission.contact.namePlaceholder}
            autoComplete="name"
            className="mt-1 w-full border border-[var(--color-term-dim)]/50 bg-transparent px-4 py-4 text-sm outline-none focus:border-[var(--color-term-accent)]"
          />
        </label>

        <label className="block">
          <span className="text-xs text-[var(--color-term-dim)]">
            {copy.admission.contact.comment}
          </span>
          <textarea
            rows={3}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder={copy.admission.contact.commentPlaceholder}
            className="mt-1 w-full border border-[var(--color-term-dim)]/50 bg-transparent px-4 py-3 text-sm outline-none focus:border-[var(--color-term-accent)]"
          />
        </label>

        {/* Не отмечен по умолчанию. Без согласия отправка невозможна — и на клиенте, и на сервере. */}
        <label className="flex items-start gap-3 text-xs leading-relaxed">
          <input
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-term-accent)]"
          />
          <span>
            {copy.admission.consent}{' '}
            <a href="/privacy" className="underline underline-offset-4">
              {copy.footer.privacy}
            </a>
          </span>
        </label>
        {touched && !consent && (
          <p className="text-xs text-[var(--color-term-warn)]">{copy.admission.consentRequired}</p>
        )}

        <button
          type="submit"
          disabled={status === 'sending'}
          className="w-full border border-[var(--color-term-accent)] px-6 py-4 text-sm text-[var(--color-term-accent)] disabled:opacity-40"
        >
          {status === 'sending' ? copy.admission.sending : copy.admission.submit}
        </button>

        {status === 'failed' && (
          <p className="text-xs text-[var(--color-term-warn)]">{copy.admission.failed}</p>
        )}
      </form>
    </section>
  );
}

/** Цена суток строкой — для передачи в заявку. */
export function dayCostLabel(day: number | null): string {
  return day !== null && day > 0 ? formatRub(day) : '';
}
