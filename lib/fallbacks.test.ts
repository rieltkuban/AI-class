import { describe, expect, it } from 'vitest';
import {
  getFallback,
  fallbacksFilled,
  mainPassesStructure,
  opponentPassesStructure,
} from './fallbacks';
import { CONTOURS } from './pricing';

describe('сохранённые прогоны', () => {
  it('есть файл на каждый контур и контур внутри совпадает', () => {
    for (const contour of CONTOURS) {
      const item = getFallback(contour);
      expect(item.contour).toBe(contour);
      expect(item.id).toContain(contour);
      expect(item.industry.length).toBeGreaterThan(0);
      expect(item.sample.length).toBeGreaterThan(0);
    }
  });

  it('заглушки честно опознаются как ненаполненные', () => {
    expect(fallbacksFilled()).toBe(false);
  });

  it('заглушка основного трека сама проходит контроль структуры', () => {
    for (const contour of CONTOURS) {
      expect(mainPassesStructure(getFallback(contour).main)).toBe(true);
      expect(opponentPassesStructure(getFallback(contour).opponent)).toBe(true);
    }
  });
});

describe('контроль структуры ответа', () => {
  const long = `${'Вывод одной фразой: маржа просела. '.repeat(8)}`;

  it('короткий ответ не проходит', () => {
    expect(mainPassesStructure('Слишком коротко.')).toBe(false);
  });

  it('обрыв на середине слова не проходит', () => {
    expect(mainPassesStructure(`${long} и дальше текст оборва`)).toBe(false);
  });

  it('нормальный ответ проходит', () => {
    expect(mainPassesStructure(long)).toBe(true);
  });

  it('оппонент: ровно три пункта', () => {
    expect(opponentPassesStructure('1. раз\n2. два\n3. три')).toBe(true);
    expect(opponentPassesStructure('1. раз\n2. два')).toBe(false);
    expect(opponentPassesStructure('1. раз\n2. два\n3. три\n4. четыре')).toBe(false);
    expect(opponentPassesStructure('— раз\n— два\n— три')).toBe(false);
  });
});
