'use client';

import { useCallback, useRef, useState } from 'react';
import { copy } from '@/content/copy';
import type { Track } from './sse';

export interface TrackState {
  label: string;
  text: string;
  done: boolean;
  /** Подставлен сохранённый прогон — показываем честную пометку. */
  fallbackReason: string | null;
}

export interface RunState {
  status: 'idle' | 'streaming' | 'finished' | 'rate_limited' | 'failed';
  main: TrackState;
  opponent: TrackState;
  divergence: string;
  rateScope: string;
}

const emptyTrack = (label: string): TrackState => ({
  label,
  text: '',
  done: false,
  fallbackReason: null,
});

const initial: RunState = {
  status: 'idle',
  main: emptyTrack(copy.run.tracks.main),
  opponent: emptyTrack(copy.run.tracks.opponent),
  divergence: '',
  rateScope: '',
};

export interface RunRequest {
  level: 'none' | 'figures' | 'fragment';
  contour: string;
  cycleDays: number;
  revenue: number;
  figures?: { period1: number; period2: number; metric: string };
  fragment?: string;
}

/**
 * Разбор нашего SSE-формата (ТЗ, 4.4). Два трека приходят в одном потоке,
 * дельты перемежаются — состояние держим по треку отдельно.
 */
export function useRunStream() {
  const [state, setState] = useState<RunState>(initial);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState(initial);
  }, []);

  const start = useCallback(async (request: RunRequest) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ ...initial, status: 'streaming' });

    let response: Response;
    try {
      response = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
    } catch {
      setState((prev) => ({ ...prev, status: 'failed' }));
      return;
    }

    if (response.status === 429) {
      const payload = (await response.json().catch(() => ({}))) as { scope?: string };
      setState((prev) => ({ ...prev, status: 'rate_limited', rateScope: payload.scope ?? 'hour' }));
      return;
    }

    if (!response.ok || !response.body) {
      setState((prev) => ({ ...prev, status: 'failed' }));
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const applyFrame = (frame: string) => {
      let name = '';
      let payload = '';
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) name = line.slice(6).trim();
        else if (line.startsWith('data:')) payload += line.slice(5).trim();
      }
      if (name === '' || payload === '') return;

      let data: Record<string, unknown>;
      try {
        data = JSON.parse(payload) as Record<string, unknown>;
      } catch {
        return;
      }

      const track = data.track as Track | undefined;

      setState((prev) => {
        if (name === 'divergence') {
          return { ...prev, divergence: String(data.text ?? '') };
        }
        if (name === 'error') {
          return { ...prev, status: 'failed' };
        }
        if (!track) return prev;

        const current = prev[track];
        let updated: TrackState = current;

        if (name === 'meta') {
          updated = { ...current, label: String(data.label ?? current.label) };
        } else if (name === 'delta') {
          updated = { ...current, text: current.text + String(data.text ?? '') };
        } else if (name === 'done') {
          updated = { ...current, done: true };
        } else if (name === 'fallback') {
          updated = {
            ...current,
            text: String(data.text ?? ''),
            done: true,
            fallbackReason: String(data.reason ?? 'provider_error'),
          };
        }

        return { ...prev, [track]: updated };
      });
    };

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let split: number;
        while ((split = buffer.indexOf('\n\n')) !== -1) {
          applyFrame(buffer.slice(0, split));
          buffer = buffer.slice(split + 2);
        }
      }
      if (buffer.trim() !== '') applyFrame(buffer);
      setState((prev) => ({ ...prev, status: 'finished' }));
    } catch {
      setState((prev) => (prev.status === 'streaming' ? { ...prev, status: 'failed' } : prev));
    }
  }, []);

  return { state, start, reset };
}
