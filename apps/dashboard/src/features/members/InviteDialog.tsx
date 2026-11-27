import { useState } from 'react';
import { Controller } from 'react-hook-form';
import { MailCheck, MailWarning, Link as LinkIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  INVITABLE_ROLES,
  createInvitationSchema,
  type CreateInvitationResponse,
  type InvitableRole,
} from '@ai-crm/shared';
import { CopyField } from '@/components/copy-field';
import { InlineAlert } from '@/components/inline-alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useWorkspace } from '@/features/workspaces/context';
import { LocaleSegmented } from '@/features/workspaces/CreateWorkspacePage';
import { ApiClientError, fieldIssues } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { fieldError, useZodForm } from '@/lib/forms';
import { cn } from '@/lib/utils';
import { useApiConfig, useMemberMutations } from './queries';

export function InviteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
}) {
  const { t } = useTranslation();
  const [result, setResult] = useState<CreateInvitationResponse | null>(null);
  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) setTimeout(() => setResult(null), 200);
  };
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-lg">
        {result ? (
          <InviteResult
            result={result}
            onAnother={() => setResult(null)}
            onDone={() => close(false)}
          />
        ) : (
          <InviteForm onCreated={setResult} onCancel={() => close(false)} />
        )}
        {!result ? <span className="sr-only">{t('invite.subtitle')}</span> : null}
      </DialogContent>
    </Dialog>
  );
}

function InviteForm({
  onCreated,
  onCancel,
}: {
  onCreated(r: CreateInvitationResponse): void;
  onCancel(): void;
}) {
  const { t } = useTranslation();
  const { workspace } = useWorkspace();
  const { invite } = useMemberMutations(workspace.id);
  const { data: config } = useApiConfig();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useZodForm(createInvitationSchema, {
    email: '',
    role: 'agent',
    locale: workspace.default_locale,
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      onCreated(await invite.mutateAsync(values));
    } catch (err) {
      const issues = fieldIssues(err);
      if (issues.email) {
        form.setError('email', { message: issues.email });
        return;
      }
      if (err instanceof ApiClientError && err.code === 'plan_limit_reached') {
        setFormError(`${errorMessage(t, err)} ${t('members.seatsHelp')}`);
        return;
      }
      setFormError(errorMessage(t, err));
    }
  });

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{t('invite.title')}</DialogTitle>
        <DialogDescription>{t('invite.subtitle')}</DialogDescription>
      </DialogHeader>
      {formError ? <InlineAlert tone="danger">{formError}</InlineAlert> : null}
      <Field label={t('invite.email')} error={fieldError(t, errors.email)}>
        <Input
          type="email"
          autoComplete="off"
          inputMode="email"
          dir="ltr"
          autoFocus
          {...form.register('email')}
        />
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-subheadline font-medium">{t('invite.role')}</legend>
        <Controller
          control={form.control}
          name="role"
          render={({ field }) => (
            <div role="radiogroup" aria-label={t('invite.role')} className="flex flex-col gap-2">
              {INVITABLE_ROLES.map((role: InvitableRole) => (
                <button
                  key={role}
                  type="button"
                  role="radio"
                  aria-checked={field.value === role}
                  onClick={() => field.onChange(role)}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border bg-surface-2 px-3.5 py-3 text-start transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-accent',
                    field.value === role && 'border-primary bg-primary/10',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'mt-1 grid size-4 shrink-0 place-items-center rounded-full border border-border-strong',
                      field.value === role && 'border-primary',
                    )}
                  >
                    {field.value === role ? (
                      <span className="size-2 rounded-full bg-primary" />
                    ) : null}
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-callout font-medium text-text-primary">
                      {t(`members.roles.${role}`)}
                    </span>
                    <span className="text-footnote text-text-secondary">
                      {t(`members.roleDescriptions.${role}`)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        />
      </fieldset>
      <Field label={t('invite.language')}>
        <Controller
          control={form.control}
          name="locale"
          render={({ field }) => (
            <LocaleSegmented
              value={field.value ?? 'ar'}
              onChange={field.onChange}
              label={t('invite.language')}
            />
          )}
        />
      </Field>
      {config?.email_delivery === 'not_configured' ? (
        <p className="flex items-center gap-2 text-footnote text-text-tertiary">
          <MailWarning aria-hidden className="size-4 text-warning" />
          {t('invite.emailNotConfigured')}
        </p>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {isSubmitting ? t('invite.submitting') : t('invite.submit')}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function InviteResult({
  result,
  onAnother,
  onDone,
}: {
  result: CreateInvitationResponse;
  onAnother?: () => void;
  onDone(): void;
}) {
  const { t } = useTranslation();
  const email = result.invitation.email;
  const view = {
    sent: {
      icon: MailCheck,
      tone: 'text-success',
      title: t('invite.sentTitle'),
      body: t('invite.sentBody', { email }),
    },
    pending: {
      icon: MailCheck,
      tone: 'text-success',
      title: t('invite.sentTitle'),
      body: t('invite.sentBody', { email }),
    },
    not_configured: {
      icon: LinkIcon,
      tone: 'text-info',
      title: t('invite.notConfiguredTitle'),
      body: t('invite.notConfiguredBody', { email }),
    },
    failed: {
      icon: MailWarning,
      tone: 'text-warning',
      title: t('invite.failedTitle'),
      body: t('invite.failedBody', { email }),
    },
  }[result.email_status];
  const Icon = view.icon;
  return (
    <div
      className="flex flex-col gap-5"
      data-testid="invite-result"
      data-email-status={result.email_status}
    >
      <DialogHeader>
        <span
          className={cn(
            'mb-2 grid size-10 place-items-center rounded-lg bg-surface-2 ring-1 ring-border',
            view.tone,
          )}
        >
          <Icon aria-hidden className="size-5" />
        </span>
        <DialogTitle>{view.title}</DialogTitle>
        <DialogDescription>{view.body}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <CopyField id="invite-link" value={result.invite_url} label={t('invite.linkLabel')} />
        <p className="text-footnote text-text-tertiary">{t('invite.linkNote')}</p>
      </div>
      <DialogFooter>
        {onAnother ? (
          <Button variant="secondary" onClick={onAnother}>
            {t('invite.another')}
          </Button>
        ) : null}
        <Button onClick={onDone}>{t('invite.done')}</Button>
      </DialogFooter>
    </div>
  );
}
