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

  it('прогоны наполнены: ни одного «ЗАМЕНИТЬ» не осталось', () => {
    expect(fallbacksFilled()).toBe(true);
    for (const contour of CONTOURS) {
      const item = getFallback(contour);
      expect(JSON.stringify(item)).not.toContain('ЗАМЕНИТЬ');
    }
  });

  // Набор уходит в промпт на уровне «без своих данных». Если там окажется
  // инструкция вместо цифр, модель ответит невнятно и её ответ отклонит
  // контроль структуры — сайт покажет сохранённый пример вместо живого
  // прогона. Так и было, пока файлы стояли незаполненными.
  it('обезличенный набор — это данные, а не описание того, что туда вписать', () => {
    for (const contour of CONTOURS) {
      const sample = getFallback(contour).sample;
      expect(sample).toMatch(/\d/);
      expect(sample.toLowerCase()).not.toContain('подставляется в промпт');
      expect(sample.toLowerCase()).not.toContain('взять из реального');
    }
  });

  it('запасной текст сам проходит контроль структуры', () => {
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
