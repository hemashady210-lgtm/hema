import { BRAND, type Locale } from '@ai-crm/shared';

export interface InvitationEmailInput {
  locale: Locale;
  workspaceName: string;
  inviterName: string | null;
  role: 'admin' | 'agent' | 'viewer';
  url: string;
  expiresAt: Date;
}

const ROLE_LABEL: Record<Locale, Record<InvitationEmailInput['role'], string>> = {
  en: { admin: 'Admin', agent: 'Agent', viewer: 'Viewer' },
  ar: { admin: 'مسؤول', agent: 'موظف خدمة', viewer: 'مشاهد' },
};

/**
 * Names typed by users (workspace, inviter) end up in an email we send from our domain. Drop
 * bidi/control characters, cap the length, and refuse anything that looks like a link, so the
 * invitation cannot be turned into a phishing message (security review L3).
 */
export function safeDisplayName(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = Array.from(value)
    .filter((ch) => {
      const c = ch.codePointAt(0) ?? 0;
      const control = c < 0x20 || (c >= 0x7f && c <= 0x9f);
      const bidi =
        c === 0x200e ||
        c === 0x200f ||
        (c >= 0x202a && c <= 0x202e) ||
        (c >= 0x2066 && c <= 0x2069);
      return !control && !bidi;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  if (!cleaned) return null;
  if (/(https?:|www\.|@|[a-z0-9-]+\.(?:[a-z]{2,}|xn--[a-z0-9-]+)\b)/i.test(cleaned)) return null;
  return cleaned;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Bilingual invitation email (ar/en). User-provided names are escaped and isolated (bdi). */
export function invitationEmail(input: InvitationEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const { locale } = input;
  const product = locale === 'ar' ? BRAND.productNameAr : BRAND.productName;
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const date = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-u-nu-latn' : 'en', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(input.expiresAt);
  const role = ROLE_LABEL[locale][input.role];
  const ws = safeDisplayName(input.workspaceName);
  const who = safeDisplayName(input.inviterName);

  // {ws} / {who} placeholders: substituted as plain text (text part) or escaped <bdi> (HTML).
  const copy =
    locale === 'ar'
      ? {
          // The subject never carries user-typed text.
          subject: `دعوة للانضمام إلى مساحة عمل على ${product}`,
          lead: ws
            ? who
              ? `دعاك {who} للانضمام إلى مساحة العمل «{ws}» بدور ${role}.`
              : `تمت دعوتك للانضمام إلى مساحة العمل «{ws}» بدور ${role}.`
            : `تمت دعوتك للانضمام إلى مساحة عمل بدور ${role}.`,
          cta: 'قبول الدعوة',
          expires: `تنتهي صلاحية هذه الدعوة في ${date}.`,
          ignore: 'إذا لم تكن تتوقع هذه الدعوة، يمكنك تجاهل هذه الرسالة.',
        }
      : {
          subject: `You're invited to a workspace on ${product}`,
          lead: ws
            ? who
              ? `{who} invited you to join the “{ws}” workspace as ${role}.`
              : `You've been invited to join the “{ws}” workspace as ${role}.`
            : `You've been invited to join a workspace as ${role}.`,
          cta: 'Accept invitation',
          expires: `This invitation expires on ${date}.`,
          ignore: "If you weren't expecting this, you can ignore this email.",
        };

  const fill = (template: string, wrap: (v: string) => string) =>
    template.replace(/\{(ws|who)\}/g, (_m, key: string) =>
      wrap(key === 'ws' ? (ws ?? '') : (who ?? '')),
    );
  const leadText = fill(copy.lead, (v) => v);
  const lead = fill(escapeHtml(copy.lead), (v) => `<bdi>${escapeHtml(v)}</bdi>`);
  const html = `<!doctype html>
<html lang="${locale}" dir="${dir}">
<body style="margin:0;padding:32px 16px;background:#f6f8fc;font-family:${locale === 'ar' ? "'IBM Plex Sans Arabic',Tahoma," : ''}-apple-system,'Segoe UI',Inter,Arial,sans-serif;color:#0b1020">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;padding:32px;border:1px solid rgba(15,28,77,0.1)" dir="${dir}">
      <tr><td style="font-size:13px;color:#4a5470;padding-bottom:24px">${escapeHtml(product)}</td></tr>
      <tr><td style="font-size:20px;line-height:${locale === 'ar' ? '34px' : '28px'};font-weight:600;padding-bottom:12px">${escapeHtml(copy.subject)}</td></tr>
      <tr><td style="font-size:15px;line-height:${locale === 'ar' ? '26px' : '22px'};color:#4a5470;padding-bottom:24px">${lead}</td></tr>
      <tr><td style="padding-bottom:24px"><a href="${escapeHtml(input.url)}" style="display:inline-block;background:#2747d1;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:12px">${escapeHtml(copy.cta)}</a></td></tr>
      <tr><td style="font-size:12px;line-height:20px;color:#6b7590">${escapeHtml(copy.expires)}<br>${escapeHtml(copy.ignore)}</td></tr>
      <tr><td dir="ltr" style="font-size:12px;line-height:18px;color:#6b7590;padding-top:16px;word-break:break-all;text-align:${locale === 'ar' ? 'right' : 'left'}">${escapeHtml(input.url)}</td></tr>
    </table>
  </td></tr></table>
</body>
</html>`;
  const text = [
    copy.subject,
    '',
    leadText,
    '',
    `${copy.cta}: ${input.url}`,
    '',
    copy.expires,
    copy.ignore,
  ].join('\n');
  return { subject: copy.subject, html, text };
}
