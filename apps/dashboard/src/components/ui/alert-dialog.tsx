import type { ReactNode } from 'react';
import { AlertDialog as A } from 'radix-ui';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { overlayClass } from './dialog';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: ReactNode;
  onConfirm(): void;
  destructive?: boolean;
  loading?: boolean;
  confirmDisabled?: boolean;
  children?: ReactNode;
}

/** Confirmation for destructive or irreversible actions. The action keeps its name (copy rule). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  destructive,
  loading,
  confirmDisabled,
  children,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  return (
    <A.Root open={open} onOpenChange={onOpenChange}>
      <A.Portal>
        <A.Overlay className={overlayClass} />
        <A.Content
          className={cn(
            'material-thick fixed start-1/2 top-1/2 z-50 grid w-[calc(100vw-2rem)] max-w-md -translate-y-1/2 gap-5 rounded-xl p-6 shadow-e3',
            'ltr:-translate-x-1/2 rtl:translate-x-1/2',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.97] data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
          )}
        >
          <div className="flex flex-col gap-1.5">
            <A.Title className="text-title-3 font-semibold">{title}</A.Title>
            <A.Description className="text-callout text-text-secondary">
              {description}
            </A.Description>
          </div>
          {children}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <A.Cancel asChild>
              <Button variant="secondary" disabled={loading}>
                {t('common.cancel')}
              </Button>
            </A.Cancel>
            <Button
              variant={destructive ? 'destructive' : 'primary'}
              loading={loading}
              disabled={confirmDisabled}
              onClick={(e) => {
                e.preventDefault();
                onConfirm();
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </A.Content>
      </A.Portal>
    </A.Root>
  );
}
