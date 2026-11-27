import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// The design-system type scale (tokens.css) defines `text-<size>` utilities; without this,
// tailwind-merge treats them as colours and drops e.g. `text-primary-foreground`.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        'display',
        'large-title',
        'title-1',
        'title-2',
        'title-3',
        'headline',
        'body',
        'callout',
        'subheadline',
        'footnote',
        'caption',
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
