// Resend adapter (A10). Contract checked against resend.com/docs (send-email, 2026-11-26):
// POST https://api.resend.com/emails, `Authorization: Bearer <key>`, JSON {from, to, subject,
// html, text}, optional `Idempotency-Key` (24 h), response {id}.
// Without RESEND_API_KEY + RESEND_FROM_EMAIL the result is `not_configured` (never faked).

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey?: string;
}

export type SendResult =
  | { status: 'sent'; id: string }
  | { status: 'failed'; error: string }
  | { status: 'not_configured' };

export interface Mailer {
  readonly configured: boolean;
  send(email: OutgoingEmail): Promise<SendResult>;
}

export function createResendMailer(
  config: { apiKey: string; from: string } | null,
  fetchImpl: typeof fetch = fetch,
): Mailer {
  return {
    configured: !!config,
    async send(email) {
      if (!config) return { status: 'not_configured' };
      try {
        const res = await fetchImpl('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${config.apiKey}`,
            'content-type': 'application/json',
            ...(email.idempotencyKey ? { 'idempotency-key': email.idempotencyKey } : {}),
          },
          body: JSON.stringify({
            from: config.from,
            to: [email.to],
            subject: email.subject,
            html: email.html,
            text: email.text,
          }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          return { status: 'failed', error: `resend ${res.status}: ${body.slice(0, 300)}` };
        }
        const data = (await res.json().catch(() => ({}))) as { id?: unknown };
        return typeof data.id === 'string'
          ? { status: 'sent', id: data.id }
          : { status: 'failed', error: 'resend: response without id' };
      } catch (err) {
        return {
          status: 'failed',
          error: `resend: ${err instanceof Error ? err.message : 'network error'}`,
        };
      }
    },
  };
}
