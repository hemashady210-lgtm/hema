import { cn } from '@/lib/utils';

describe('cn', () => {
  it('keeps text colour and design-system text size together', () => {
    expect(cn('text-primary-foreground', 'text-callout')).toBe(
      'text-primary-foreground text-callout',
    );
    expect(cn('text-footnote', 'text-caption')).toBe('text-caption');
    expect(cn('text-danger', 'text-success')).toBe('text-success');
  });
});
