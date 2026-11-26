import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { logicalCssRule, physicalPrefix } from '../../../../eslint-rules/logical-css.js';

describe('physicalPrefix', () => {
  it.each([
    ['ml-2', 'ml'],
    ['md:pr-4', 'pr'],
    ['-left-1', 'left'],
    ['hover:text-right', 'text-right'],
    ['rounded-tl-lg', 'rounded-tl'],
    ['!border-l', 'border-l'],
    ['right-[3px]', 'right'],
  ])('flags %s', (token, prefix) => {
    expect(physicalPrefix(token)).toBe(prefix);
  });

  it.each([
    'ms-2',
    'pe-4',
    'start-0',
    'end-1',
    'text-start',
    'rounded-s-lg',
    'border-e',
    'left',
    'rtl:-scale-x-100',
    'ltr:ml-2',
    'inset-x-0',
    'mx-auto',
    'px-4',
  ])('allows %s', (token) => {
    expect(physicalPrefix(token)).toBeNull();
  });
});

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

tester.run('logical-css', logicalCssRule, {
  valid: [
    { code: '<div className="ms-2 pe-4 text-start" />' },
    { code: "const c = cn('ps-3', cond && 'end-0');" },
    { code: "const v = cva('rounded-s-md', { variants: { size: { sm: 'ms-1' } } });" },
    { code: "const label = 'left side';" },
  ],
  invalid: [
    { code: '<div className="ml-2" />', errors: [{ messageId: 'physical' }] },
    { code: '<div className={`p-2 ${x} pr-4`} />', errors: [{ messageId: 'physical' }] },
    {
      code: "const c = cn('ps-3', cond ? 'left-0' : 'end-0');",
      errors: [{ messageId: 'physical' }],
    },
    {
      code: "const v = cva('rounded-l-md', { variants: { size: { sm: 'mr-1' } } });",
      errors: [{ messageId: 'physical' }, { messageId: 'physical' }],
    },
    { code: "const c = clsx({ 'text-right': on });", errors: [{ messageId: 'physical' }] },
    { code: '<div className={cn("a", cn("border-r"))} />', errors: [{ messageId: 'physical' }] },
  ],
});
