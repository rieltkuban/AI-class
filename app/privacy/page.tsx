export const metadata = { title: 'Обработка персональных данных' };

/** Юридический текст даёт заказчик. Здесь плейсхолдер. */
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="text-lg">Политика обработки персональных данных</h1>
      <p className="mt-6 max-w-prose text-sm leading-relaxed text-[var(--color-term-warn)]">
        ЗАМЕНИТЬ. Юридический текст предоставляет заказчик.
      </p>
      <a href="/" className="mt-10 inline-block text-xs underline underline-offset-4">
        Назад
      </a>
    </main>
  );
}
