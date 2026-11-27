import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

/**
 * The one expressive surface of the product: an example conversation that shows what the
 * assistant does — Arabic and English, each in its own direction — on a thin "live" timeline.
 * Labelled as an example (DESIGN_SYSTEM §1.4: never present illustrative content as data).
 * Fixed dark palette in both themes (brand surface). One staggered reveal on load.
 */
export function BrandPanel() {
  const { t } = useTranslation();
  const messages = [
    {
      who: t('auth.brand.customerName'),
      text: t('auth.brand.customerMessage'),
      lang: 'ar',
      from: 'customer',
    },
    {
      who: t('auth.brand.assistantName'),
      text: t('auth.brand.assistantMessage'),
      lang: 'ar',
      from: 'assistant',
    },
    {
      who: t('auth.brand.customerName'),
      text: t('auth.brand.englishMessage'),
      lang: 'en',
      from: 'customer',
    },
    {
      who: t('auth.brand.assistantName'),
      text: t('auth.brand.englishReply'),
      lang: 'en',
      from: 'assistant',
    },
  ] as const;
  return (
    <aside
      aria-label={t('auth.brand.exampleLabel')}
      className="relative hidden overflow-hidden bg-[#0a1233] text-[#f2f5fc] lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16"
    >
      {/* Quiet structure: a fine dot grid fading toward the form side. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:radial-gradient(rgb(148_170_255/0.22)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
      />
      <p className="relative max-w-md text-large-title font-semibold tracking-[-0.015em] text-balance">
        {t('auth.brand.tagline')}
      </p>

      <figure className="relative my-12 max-w-md">
        <figcaption className="mb-5 text-footnote text-[#a6b0c6]">
          {t('auth.brand.exampleLabel')}
        </figcaption>
        <ol className="relative flex flex-col gap-4 ps-6">
          <span
            aria-hidden
            className="absolute start-[7px] top-2 bottom-2 w-px bg-gradient-to-b from-[#00a8ff] via-[#00a8ff]/40 to-transparent"
          />
          {messages.map((m, i) => (
            <li
              key={i}
              className="brand-reveal relative"
              style={{ animationDelay: `${180 + i * 420}ms` }}
            >
              <span
                aria-hidden
                className={cn(
                  'absolute -start-6 top-3.5 size-[15px] rounded-full border-2 border-[#0a1233]',
                  m.from === 'assistant' ? 'bg-[#00a8ff]' : 'bg-[#3d63f0]',
                )}
              />
              <p className="mb-1 text-caption text-[#a6b0c6]">{m.who}</p>
              <p
                lang={m.lang}
                dir="auto"
                className={cn(
                  'inline-block max-w-[42ch] rounded-xl px-3.5 py-2.5 text-callout leading-relaxed',
                  m.from === 'assistant'
                    ? 'bg-[#16297a]/70 ring-1 ring-[#6688ff]/30'
                    : 'bg-white/[0.06] ring-1 ring-white/10',
                  m.lang === 'ar' && 'font-[family-name:var(--font-arabic)]',
                )}
              >
                {m.text}
              </p>
            </li>
          ))}
        </ol>
      </figure>

      <div className="relative flex flex-col gap-5">
        <ul className="flex flex-col gap-2.5">
          {(['bilingual', 'grounded', 'handoff'] as const).map((k) => (
            <li key={k} className="flex items-start gap-2.5 text-callout text-[#c2d1ff]">
              <Check aria-hidden className="mt-1 size-4 shrink-0 text-[#00a8ff]" />
              <span>{t(`auth.brand.points.${k}`)}</span>
            </li>
          ))}
        </ul>
        <p className="text-footnote text-[#a6b0c6]">{t('auth.brand.channels')}</p>
      </div>
    </aside>
  );
}
