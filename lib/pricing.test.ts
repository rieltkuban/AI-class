import { describe, expect, it } from 'vitest';
import {
  CONTOURS,
  CYCLE_DAYS,
  MAX_REVENUE,
  MIN_REVENUE,
  estimate,
  revenueBand,
  type Contour,
  type CycleDays,
} from './pricing';

describe('estimate — три контрольных набора (ТЗ, этап 2)', () => {
  it('набор 1: ценовые решения, цикл 7 дней, выручка 1 млрд', () => {
    const r = estimate({ contour: 'price', cycleDays: 7, revenue: 1_000_000_000 });
    expect(r.status).toBe('ok');
    // V = 1e9 * 0,6 / 24 = 25 000 000; day = 25e6 * 0,5% = 125 000 → 130 000
    expect(r.breakdown?.perDecision).toBe(25_000_000);
    expect(r.breakdown?.rawDay).toBe(125_000);
    expect(r.day).toBe(130_000);
    // year = 125 000 * 6 * 24 = 18 000 000
    expect(r.year).toBe(18_000_000);
    expect(r.capped).toBe(false);
  });

  it('набор 2: сделки, цикл 3 дня, выручка 500 млн', () => {
    const r = estimate({ contour: 'deal', cycleDays: 3, revenue: 500_000_000 });
    expect(r.status).toBe('ok');
    expect(r.breakdown?.perDecision).toBe(4_375_000);
    expect(r.breakdown?.rawDay).toBe(35_000);
    expect(r.day).toBe(40_000);
    expect(r.year).toBe(2_800_000);
  });

  it('набор 3: инвестиционные, цикл 14 дней, выручка 2 млрд', () => {
    const r = estimate({ contour: 'invest', cycleDays: 14, revenue: 2_000_000_000 });
    expect(r.status).toBe('ok');
    expect(r.breakdown?.rawDay).toBeCloseTo(1_000_000, 6);
    expect(r.day).toBe(1_000_000);
    expect(r.breakdown?.excessDays).toBe(13);
    expect(r.year).toBe(78_000_000);
  });
});

describe('estimate — ограничитель абсурда (ТЗ, 5.3)', () => {
  it('выручка ниже порога отсекается и цифра не показывается', () => {
    const r = estimate({ contour: 'price', cycleDays: 7, revenue: MIN_REVENUE - 1 });
    expect(r.status).toBe('below_scale');
    expect(r.day).toBeNull();
    expect(r.year).toBeNull();
    expect(r.breakdown).toBeNull();
  });

  it('ровно порог — уже считаем', () => {
    expect(estimate({ contour: 'price', cycleDays: 7, revenue: MIN_REVENUE }).status).toBe('ok');
  });

  it('выше 100 млрд — переспрашиваем порядок', () => {
    const r = estimate({ contour: 'price', cycleDays: 7, revenue: MAX_REVENUE + 1 });
    expect(r.status).toBe('suspicious_scale');
    expect(r.day).toBeNull();
  });

  it('ровно 100 млрд — считаем', () => {
    expect(estimate({ contour: 'ops', cycleDays: 3, revenue: MAX_REVENUE }).status).toBe('ok');
  });

  it('нечисловая выручка не роняет расчёт', () => {
    expect(estimate({ contour: 'hr', cycleDays: 1, revenue: Number.NaN }).status).toBe('below_scale');
  });
});

describe('estimate — краевые случаи', () => {
  it('цикл 1 день: избыточных суток нет, годовая оценка нулевая', () => {
    const r = estimate({ contour: 'price', cycleDays: 1, revenue: 1_000_000_000 });
    expect(r.breakdown?.excessDays).toBe(0);
    expect(r.year).toBe(0);
  });

  it('кадровые решения при минимальной выручке: сутки дешевле шага округления', () => {
    const r = estimate({ contour: 'hr', cycleDays: 1, revenue: MIN_REVENUE });
    expect(r.breakdown?.rawDay).toBe(500);
    expect(r.day).toBe(0);
    expect(r.dayBelowRounding).toBe(true);
  });

  it('годовая оценка ни при каких допустимых входах не превышает 15% выручки', () => {
    // Следствие констант 5.2: year = revenue * k * p * excess, максимум ≈ 3,6% (deal, 14 дней).
    // Потолок из 5.1 при текущих константах не срабатывает никогда — см. отчёт по этапу 2.
    for (const contour of CONTOURS as readonly Contour[]) {
      for (const cycleDays of CYCLE_DAYS as readonly CycleDays[]) {
        const revenue = 5_000_000_000;
        const r = estimate({ contour, cycleDays, revenue });
        expect(r.status).toBe('ok');
        expect(r.year!).toBeLessThanOrEqual(revenue * 0.15);
        expect(r.capped).toBe(false);
      }
    }
  });
});

describe('revenueBand — на сервер уходит только порядок', () => {
  it.each([
    [9_000_000, '<10 млн'],
    [50_000_000, '10–100 млн'],
    [300_000_000, '100–500 млн'],
    [700_000_000, '500 млн – 1 млрд'],
    [2_000_000_000, '1–5 млрд'],
    [10_000_000_000, '5–20 млрд'],
    [50_000_000_000, '20–100 млрд'],
    [200_000_000_000, '>100 млрд'],
  ])('%i → %s', (revenue, band) => {
    expect(revenueBand(revenue)).toBe(band);
  });
});
