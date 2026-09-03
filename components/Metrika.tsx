import Script from 'next/script';

/**
 * Яндекс.Метрика. Подключается только когда задан NEXT_PUBLIC_METRIKA_ID.
 * Скрипт грузится с mc.yandex.ru — российский домен, разрешён.
 * Никаких Google Analytics и Vercel Analytics на сайте нет.
 */
export function Metrika({ id }: { id: number | null }) {
  if (!id) return null;

  return (
    <Script id="metrika" strategy="afterInteractive">
      {`
        (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
        m[i].l=1*new Date();
        for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
        k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
        (window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");
        ym(${id}, "init", { clickmap:true, trackLinks:true, accurateTrackBounce:true });
      `}
    </Script>
  );
}

export function metrikaIdFromEnv(): number | null {
  const raw = process.env.NEXT_PUBLIC_METRIKA_ID;
  const value = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(value) && value > 0 ? value : null;
}
