import { z } from 'zod';

/**
 * Password rules. Must match supabase/config.toml (`minimum_password_length = 8`,
 * `password_requirements = "letters_digits"`) and the hosted project's Auth settings.
 */
export const PASSWORD_RULES = {
  minLength: 8,
  maxLength: 72, // bcrypt input limit used by Supabase Auth
  requireLetter: true,
  requireDigit: true,
} as const;

export const emailSchema = z
  .string()
  .trim()
  .min(1, { error: 'validation.required' })
  .max(254, { error: 'validation.too_long' })
  .pipe(z.email({ error: 'validation.email' }));

export const passwordSchema = z
  .string()
  .min(PASSWORD_RULES.minLength, { error: 'validation.password_min' })
  .max(PASSWORD_RULES.maxLength, { error: 'validation.password_max' })
  .regex(/\p{L}/u, { error: 'validation.password_letter' })
  .regex(/\d/, { error: 'validation.password_digit' });

export const signInSchema = z.object({
  email: emailSchema,
  // Sign-in only checks presence; the server decides whether the password is right.
  password: z.string().min(1, { error: 'validation.required' }),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const magicLinkSchema = z.object({ email: emailSchema });
export type MagicLinkInput = z.infer<typeof magicLinkSchema>;

/**
 * Sign-up proves the email first (link), then asks for a password (`setPasswordSchema`).
 * Security review H1: Supabase Auth keeps the password of an unconfirmed account when someone
 * else signs up with the same address, so no password is collected before confirmation
 * (migration 0016 also clears any pre-confirmation password server-side).
 */
export const signUpSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(1, { error: 'validation.required' })
    .max(120, { error: 'validation.too_long' }),
  email: emailSchema,
  accept_terms: z.literal(true, { error: 'validation.accept_terms' }),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirm: z.string().min(1, { error: 'validation.required' }),
  })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    error: 'validation.password_mismatch',
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/** Choosing the first password after email confirmation: same rules as a reset. */
export const setPasswordSchema = resetPasswordSchema;

/** Password strength 0–4 for the meter (length + character classes); not a policy. */
export function passwordStrength(password: string): 0 | 1 | 2 | 3 | 4 {
  if (!password) return 0;
  let score = 0;
  if (password.length >= PASSWORD_RULES.minLength) score++;
  if (password.length >= 12) score++;
  if (/\p{L}/u.test(password) && /\d/.test(password)) score++;
  if (/[^\p{L}\d]/u.test(password) || (/[a-z]/.test(password) && /[A-Z]/.test(password))) score++;
  return Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
}

/**
 * Only same-app relative paths are accepted as a post-auth redirect target
 * (prevents open redirects: `//evil.com`, `/\\evil.com`, `https://…`).
 */
export function safeRedirectPath(value: string | null | undefined, fallback = '/'): string {
  if (!value) return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) < 0x20 || value.charCodeAt(i) === 0x7f) return fallback;
  }
  return value;
}
