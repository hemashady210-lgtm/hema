// ESLint rule `local/logical-css` (DESIGN_SYSTEM §10.2, CLAUDE.md bilingual rule).
// Flags physical-direction Tailwind utilities (ml-, pr-, left-, text-right, rounded-l, …) in
// class strings so layouts mirror correctly in RTL. Use the logical equivalents instead:
// ms-/me-, ps-/pe-, start-/end-, text-start/end, border-s/e, rounded-s/e, …
//
// Checked places: JSX `className` / `class` attributes, and string arguments (including nested
// objects/arrays, e.g. cva variants) of cn(), clsx(), cva(), twMerge(), tv().

const CLASS_FUNCTIONS = new Set(['cn', 'clsx', 'cva', 'twMerge', 'tv']);

const SUGGESTIONS = {
  ml: 'ms',
  mr: 'me',
  pl: 'ps',
  pr: 'pe',
  left: 'start',
  right: 'end',
  'border-l': 'border-s',
  'border-r': 'border-e',
  'rounded-l': 'rounded-s',
  'rounded-r': 'rounded-e',
  'rounded-tl': 'rounded-ss',
  'rounded-tr': 'rounded-se',
  'rounded-bl': 'rounded-es',
  'rounded-br': 'rounded-ee',
  'text-left': 'text-start',
  'text-right': 'text-end',
  'float-left': 'float-start',
  'float-right': 'float-end',
  'clear-left': 'clear-start',
  'clear-right': 'clear-end',
  'scroll-ml': 'scroll-ms',
  'scroll-mr': 'scroll-me',
  'scroll-pl': 'scroll-ps',
  'scroll-pr': 'scroll-pe',
};

// Longest prefixes first so `rounded-tl` wins over `rounded`.
const PREFIXES = Object.keys(SUGGESTIONS).sort((a, b) => b.length - a.length);

/** Returns the offending prefix for one class token, or null. */
export function physicalPrefix(token) {
  // Strip variants (`md:`, `hover:`, `rtl:`…) and the important / negative markers.
  const parts = token.split(':');
  // Explicit `ltr:` / `rtl:` variants are deliberate direction-specific styling: allowed.
  if (parts.slice(0, -1).some((v) => v === 'ltr' || v === 'rtl')) return null;
  let base = parts[parts.length - 1] ?? '';
  base = base.replace(/^!/, '').replace(/^-/, '');
  for (const prefix of PREFIXES) {
    if (base === prefix || base.startsWith(`${prefix}-`) || base.startsWith(`${prefix}[`)) {
      // `left`/`right` alone are not utilities; require a value (`left-0`, `right-[3px]`).
      if ((prefix === 'left' || prefix === 'right') && base === prefix) return null;
      return prefix;
    }
  }
  return null;
}

function checkString(context, node, value) {
  for (const token of value.split(/\s+/)) {
    if (!token) continue;
    const prefix = physicalPrefix(token);
    if (prefix) {
      context.report({
        node,
        messageId: 'physical',
        data: { token, prefix, logical: SUGGESTIONS[prefix] },
      });
    }
  }
}

function visitValue(context, node, seen) {
  if (!node) return;
  switch (node.type) {
    case 'Literal':
      if (typeof node.value === 'string') checkString(context, node, node.value);
      break;
    case 'TemplateLiteral':
      for (const q of node.quasis) checkString(context, q, q.value.cooked ?? '');
      for (const e of node.expressions) visitValue(context, e, seen);
      break;
    case 'JSXExpressionContainer':
      visitValue(context, node.expression, seen);
      break;
    case 'ConditionalExpression':
      visitValue(context, node.consequent, seen);
      visitValue(context, node.alternate, seen);
      break;
    case 'LogicalExpression':
      visitValue(context, node.right, seen);
      break;
    case 'ArrayExpression':
      for (const el of node.elements) visitValue(context, el, seen);
      break;
    case 'ObjectExpression':
      for (const prop of node.properties) {
        if (prop.type === 'Property') {
          // clsx({ 'ml-2': cond }) → the key is the class list.
          if (prop.key.type === 'Literal') visitValue(context, prop.key, seen);
          visitValue(context, prop.value, seen);
        }
      }
      break;
    case 'CallExpression':
      if (node.callee.type === 'Identifier' && CLASS_FUNCTIONS.has(node.callee.name)) {
        seen.add(node);
        for (const arg of node.arguments) visitValue(context, arg, seen);
      }
      break;
    default:
      break;
  }
}

export const logicalCssRule = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow physical-direction Tailwind utilities; use logical ones.' },
    messages: {
      physical:
        "'{{token}}' uses a physical direction ('{{prefix}}'). Use the logical '{{logical}}' equivalent so RTL mirrors correctly.",
    },
    schema: [],
  },
  create(context) {
    // Calls already checked through a parent (className={cn(...)}, nested cn()) are skipped.
    const seen = new WeakSet();
    return {
      JSXAttribute(node) {
        const name = node.name && node.name.name;
        if (name === 'className' || name === 'class') visitValue(context, node.value, seen);
      },
      CallExpression(node) {
        if (seen.has(node)) return;
        visitValue(context, node, seen);
      },
    };
  },
};

export default {
  meta: { name: 'eslint-plugin-local' },
  rules: { 'logical-css': logicalCssRule },
};
