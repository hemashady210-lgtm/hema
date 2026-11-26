import { z } from 'zod';
import { emailSchema } from './auth.ts';
import { LOCALES, type Locale } from './locales.ts';
import { INVITABLE_ROLES } from './roles.ts';

/**
 * App API contract (docs/API.md). Shared by the `api` Edge Function (Deno) and the dashboard.
 * Error envelope: `{ error: { code, message, details?, request_id } }`.
 */
export const API_ERRORS = {
  validation_failed: { status: 400, en: 'Some fields are invalid.', ar: 'بعض الحقول غير صالحة.' },
  unauthenticated: { status: 401, en: 'Please sign in again.', ar: 'يرجى تسجيل الدخول مرة أخرى.' },
  plan_limit_reached: {
    status: 402,
    en: "You've reached your plan's limit.",
    ar: 'لقد بلغت الحد المسموح في خطتك.',
  },
  feature_not_in_plan: {
    status: 402,
    en: 'This feature is not included in your plan.',
    ar: 'هذه الميزة غير متاحة في خطتك.',
  },
  trial_limit_reached: {
    status: 402,
    en: "You've already used your free trial. Additional workspaces need a paid plan.",
    ar: 'لقد استخدمت تجربتك المجانية. تحتاج مساحات العمل الإضافية إلى خطة مدفوعة.',
  },
  forbidden: {
    status: 403,
    en: "You don't have permission to do this.",
    ar: 'ليست لديك صلاحية للقيام بذلك.',
  },
  workspace_read_only: {
    status: 403,
    en: 'This workspace is read-only.',
    ar: 'مساحة العمل هذه للقراءة فقط.',
  },
  email_not_verified: {
    status: 403,
    en: 'Verify your email address first.',
    ar: 'يرجى تأكيد بريدك الإلكتروني أولًا.',
  },
  invitation_email_mismatch: {
    status: 403,
    en: 'This invitation was sent to a different email address.',
    ar: 'أُرسلت هذه الدعوة إلى بريد إلكتروني مختلف.',
  },
  not_found: { status: 404, en: 'Not found.', ar: 'غير موجود.' },
  member_not_found: { status: 404, en: 'Member not found.', ar: 'العضو غير موجود.' },
  invitation_not_found: {
    status: 404,
    en: 'This invitation link is not valid.',
    ar: 'رابط الدعوة هذا غير صالح.',
  },
  conflict: {
    status: 409,
    en: 'This conflicts with the current state.',
    ar: 'يتعارض هذا مع الحالة الحالية.',
  },
  slug_taken: {
    status: 409,
    en: 'This workspace URL is already taken.',
    ar: 'رابط مساحة العمل هذا مستخدم بالفعل.',
  },
  already_member: {
    status: 409,
    en: 'This person is already a member.',
    ar: 'هذا الشخص عضو بالفعل.',
  },
  invitation_used: {
    status: 409,
    en: 'This invitation has already been used.',
    ar: 'تم استخدام هذه الدعوة بالفعل.',
  },
  invitation_closed: {
    status: 409,
    en: 'This invitation is no longer open.',
    ar: 'لم تعد هذه الدعوة مفتوحة.',
  },
  cannot_change_owner: {
    status: 409,
    en: "The owner's role can only change by transferring ownership.",
    ar: 'لا يتغير دور المالك إلا بنقل الملكية.',
  },
  cannot_change_own_role: {
    status: 409,
    en: "You can't change your own role.",
    ar: 'لا يمكنك تغيير دورك بنفسك.',
  },
  cannot_remove_owner: {
    status: 409,
    en: "The owner can't be removed.",
    ar: 'لا يمكن إزالة المالك.',
  },
  owner_cannot_leave: {
    status: 409,
    en: 'Transfer ownership before leaving this workspace.',
    ar: 'انقل الملكية قبل مغادرة مساحة العمل.',
  },
  invitation_expired: {
    status: 410,
    en: 'This invitation has expired. Ask for a new one.',
    ar: 'انتهت صلاحية هذه الدعوة. اطلب دعوة جديدة.',
  },
  invitation_revoked: {
    status: 410,
    en: 'This invitation was cancelled.',
    ar: 'أُلغيت هذه الدعوة.',
  },
  rate_limited: {
    status: 429,
    en: 'Too many attempts. Try again shortly.',
    ar: 'محاولات كثيرة. حاول مرة أخرى بعد قليل.',
  },
  internal: {
    status: 500,
    en: 'Something went wrong on our side.',
    ar: 'حدث خطأ من جهتنا.',
  },
} as const satisfies Record<string, { status: number; en: string; ar: string }>;

export type ApiErrorCode = keyof typeof API_ERRORS;

export function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return typeof value === 'string' && Object.hasOwn(API_ERRORS, value);
}

export function apiErrorMessage(code: ApiErrorCode, locale: Locale): string {
  return API_ERRORS[code][locale];
}

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: Record<string, unknown>;
    request_id?: string;
  };
}

// ---------------------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------------------

/** Raw invitation tokens: 32 random bytes, base64url (43 chars). */
export const INVITATION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const invitationTokenSchema = z
  .string()
  .regex(INVITATION_TOKEN_PATTERN, { error: 'validation.invalid' });

export const createInvitationSchema = z.object({
  email: emailSchema,
  role: z.enum(INVITABLE_ROLES, { error: 'validation.required' }),
  locale: z.enum(LOCALES).default('ar'),
});
export type CreateInvitationInput = z.input<typeof createInvitationSchema>;

export const invitationTokenBodySchema = z.object({ token: invitationTokenSchema });

export const changeMemberRoleSchema = z.object({
  role: z.enum(INVITABLE_ROLES, { error: 'validation.required' }),
});

export const transferOwnershipSchema = z.object({
  user_id: z.uuid({ error: 'validation.invalid' }),
});

// ---------------------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------------------

export type EmailDeliveryStatus = 'pending' | 'sent' | 'failed' | 'not_configured';

export interface InvitationSummary {
  id: string;
  workspace_id: string;
  email: string;
  role: (typeof INVITABLE_ROLES)[number];
  expires_at: string;
  email_status: EmailDeliveryStatus;
  locale: Locale;
}

export interface CreateInvitationResponse {
  invitation: InvitationSummary;
  /** The only time the raw link exists; renewing creates a new one. */
  invite_url: string;
  email_status: EmailDeliveryStatus;
}

export type InvitationState = 'valid' | 'expired' | 'revoked' | 'accepted';

export interface InvitationPreviewResponse {
  workspace_name: string;
  role: (typeof INVITABLE_ROLES)[number];
  /** Masked unless the signed-in caller owns this address. */
  email: string;
  email_matches_caller: boolean | null;
  inviter_name: string | null;
  expires_at: string;
  state: InvitationState;
}

export interface AcceptInvitationResponse {
  workspace_id: string;
  workspace_slug: string;
  role: string;
}

export interface ApiConfigResponse {
  email_delivery: 'configured' | 'not_configured';
}

/** Masks an address for display to someone who may not own it: `s***@example.com`. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 1) return '***';
  return `${email[0]}***${email.slice(at)}`;
}
