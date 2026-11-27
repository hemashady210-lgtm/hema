import { Camera, Check, Globe, MessageCircle, Send, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AnimatedGradient } from '@/components/effects/ambient';
import { AnimatedBeams, type Beam } from '@/components/effects/animated-beam';
import { BrandCore } from '@/components/effects/brand-core';
import { cn } from '@/lib/utils';

/**
 * The product's one expressive surface (DESIGN_SYSTEM §14, signature): every channel lands with
 * one assistant. Channel chips on the inline-start side send light along beams into the glass
 * core (WebGL on capable desktops, CSS poster otherwise); then a labelled example exchange — in
 * Arabic and English, each in its own direction — appears once. Fixed dark brand surface in
 * both themes. Loaded lazily and only at ≥ 1024 px (AuthLayout).
 */

const NODES: {
  key: 'whatsapp' | 'instagram' | 'messenger' | 'website';
  icon: LucideIcon;
  y: number;
}[] = [
  { key: 'whatsapp', icon: MessageCircle, y: 13 },
  { key: 'instagram', icon: Camera, y: 37.5 },
  { key: 'messenger', icon: Send, y: 62.5 },
  { key: 'website', icon: Globe, y: 87 },
];

// Logical 0–100 stage coordinates: from under each chip to the core's inline-start edge.
const BEAMS: Beam[] = NODES.map((n, i) => ({
  from: [18, n.y],
  to: [63, 50],
  curvature: (50 - n.y) * 0.35,
  delay: 0.35 + i * 0.55,
  duration: 3.2,
}));

export function BrandPanel() {
  const { t } = useTranslation();
  const messages = [
    { text: t('auth.brand.customerMessage'), lang: 'ar', from: 'customer' },
    { text: t('auth.brand.assistantMessage'), lang: 'ar', from: 'assistant' },
    { text: t('auth.brand.englishMessage'), lang: 'en', from: 'customer' },
    { text: t('auth.brand.englishReply'), lang: 'en', from: 'assistant' },
  ] as const;
  return (
    <aside
      aria-label={t('auth.brand.exampleLabel')}
      className="relative isolate hidden overflow-hidden bg-[#070b1f] text-[#f2f5fc] lg:flex lg:flex-col lg:gap-[clamp(18px,3.2vh,34px)] lg:p-12 xl:p-16"
    >
      <AnimatedGradient />
      {/* Hairline at the seam with the form column. */}
      <span aria-hidden className="absolute inset-y-0 start-0 w-px bg-white/[0.06]" />

      <p className="relative max-w-md text-large-title font-semibold text-balance">
        {t('auth.brand.tagline')}
      </p>

      <div
        role="img"
        aria-label={t('auth.brand.stageLabel')}
        className="relative h-[clamp(170px,29vh,260px)] shrink-0"
      >
        <AnimatedBeams beams={BEAMS} />
        {NODES.map(({ key, icon: Icon, y }) => (
          <span
            key={key}
            aria-hidden
            style={{ top: `${y}%` }}
            className="absolute start-0 inline-flex h-9 -translate-y-1/2 items-center gap-2 rounded-full bg-[#0d1533]/90 ps-1.5 pe-3.5 text-subheadline text-[#dfe6ff] shadow-[0_8px_24px_-12px_rgb(0_0_0/0.8)] ring-1 ring-white/12"
          >
            <span className="grid size-6 place-items-center rounded-full bg-[#3d63f0]/25 text-[#9fb4ff] ring-1 ring-[#6688ff]/30">
              <Icon className="size-3.5" strokeWidth={2} />
            </span>
            {t(`auth.brand.nodes.${key}`)}
          </span>
        ))}
        <BrandCore className="absolute end-0 top-1/2 aspect-square h-[118%] -translate-y-1/2" />
      </div>

      <figure className="relative max-w-lg">
        <figcaption className="mb-3 text-footnote text-[#a6b0c6]">
          {t('auth.brand.exampleLabel')}
        </figcaption>
        <ol className="flex flex-col gap-2.5">
          {messages.map((m, i) => (
            <li
              key={i}
              className={cn(
                'brand-reveal flex flex-col gap-1',
                m.from === 'assistant' ? 'items-end' : 'items-start',
              )}
              style={{ animationDelay: `${700 + i * 380}ms` }}
            >
              <span className="sr-only">
                {m.from === 'assistant'
                  ? t('auth.brand.assistantName')
                  : t('auth.brand.customerName')}
              </span>
              <p
                lang={m.lang}
                dir="auto"
                className={cn(
                  'max-w-[40ch] rounded-2xl px-3.5 py-2 text-subheadline leading-relaxed',
                  m.from === 'assistant'
                    ? 'decor-glow rounded-ee-md bg-[linear-gradient(135deg,#2747d1,#3d63f0)] text-white shadow-[0_10px_30px_-14px_rgb(61_99_240/0.9)]'
                    : 'rounded-es-md bg-white/[0.07] ring-1 ring-white/10',
                  m.lang === 'ar' && 'font-[family-name:var(--font-arabic)] text-callout',
                )}
              >
                {m.text}
              </p>
            </li>
          ))}
        </ol>
      </figure>

      <ul className="relative mt-auto flex flex-col gap-2">
        {(['bilingual', 'grounded', 'handoff'] as const).map((k) => (
          <li key={k} className="flex items-start gap-2.5 text-callout text-[#c2d1ff]">
            <Check aria-hidden className="mt-1 size-4 shrink-0 text-[#2ebbff]" />
            <span>{t(`auth.brand.points.${k}`)}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
