/**
 * Единственная страница сайта: машина состояний на семь экранов (ТЗ, 4.1).
 *
 * Этап 1 (каркас и тексты) не начат: тексты интерфейса берутся из документа 8
 * дословно и не сочиняются (ТЗ, 13.1). Документ 8 в работу не передан.
 */
export default function Page() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-lg">ИИ-Академия</h1>
      <p className="mt-4 text-sm text-[var(--color-term-dim)]">
        Каркас в разработке. Готово: детерминированный расчёт цены суток
        (<code>lib/pricing.ts</code>, <code>POST /api/estimate</code>).
      </p>
    </main>
  );
}
