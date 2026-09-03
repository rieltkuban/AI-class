import { beforeEach, describe, expect, it } from 'vitest';
import { checkRunLimit, clientIp, resetRunLimits } from './ratelimit';

beforeEach(() => {
  resetRunLimits();
  process.env.RATE_LIMIT_RUNS_PER_HOUR = '3';
  process.env.RATE_LIMIT_RUNS_PER_DAY = '10';
});

describe('лимит прогонов', () => {
  it('три прогона в час проходят, четвёртый — нет', () => {
    for (let i = 0; i < 3; i++) expect(checkRunLimit('a').allowed).toBe(true);
    const verdict = checkRunLimit('a');
    expect(verdict.allowed).toBe(false);
    expect(verdict.scope).toBe('hour');
    expect(verdict.retryAfterSec).toBeGreaterThan(0);
  });

  it('адреса не мешают друг другу', () => {
    for (let i = 0; i < 3; i++) checkRunLimit('a');
    expect(checkRunLimit('b').allowed).toBe(true);
  });

  it('через час окно открывается снова', () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) checkRunLimit('a', t0);
    expect(checkRunLimit('a', t0).allowed).toBe(false);
    expect(checkRunLimit('a', t0 + 60 * 60 * 1000 + 1).allowed).toBe(true);
  });

  it('суточный потолок держит, даже когда часовое окно обновилось', () => {
    const hour = 60 * 60 * 1000;
    let t = 1_000_000;
    for (let i = 0; i < 10; i++) {
      expect(checkRunLimit('a', t).allowed).toBe(true);
      if ((i + 1) % 3 === 0) t += hour + 1;
    }
    const verdict = checkRunLimit('a', t);
    expect(verdict.allowed).toBe(false);
    expect(verdict.scope).toBe('day');
  });
});

describe('реальный адрес посетителя', () => {
  it('берётся первый адрес из x-forwarded-for', () => {
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1, 127.0.0.1' });
    expect(clientIp(headers)).toBe('203.0.113.7');
  });

  it('без заголовка — не 127.0.0.1, а честное unknown', () => {
    expect(clientIp(new Headers())).toBe('unknown');
  });

  it('x-real-ip как запасной', () => {
    expect(clientIp(new Headers({ 'x-real-ip': '198.51.100.4' }))).toBe('198.51.100.4');
  });
});
