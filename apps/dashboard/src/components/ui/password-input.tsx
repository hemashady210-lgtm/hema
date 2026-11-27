import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { inputClass } from './input';

export const PasswordInput = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>
>(({ className, ...props }, ref) => {
  const [visible, setVisible] = useState(false);
  const { t } = useTranslation();
  const label = visible ? t('common.hidePassword') : t('common.showPassword');
  // Passwords are an always-LTR island (DESIGN_SYSTEM §10.4); the toggle sits at its end.
  return (
    <div className="relative" dir="ltr">
      <input
        ref={ref}
        type={visible ? 'text' : 'password'}
        className={cn(inputClass, 'pe-10', className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={label}
        aria-pressed={visible}
        className="absolute inset-y-0 end-0 flex w-10 items-center justify-center rounded-e-md text-text-tertiary hover:text-text-primary focus-visible:outline-2 focus-visible:outline-accent"
      >
        {visible ? (
          <EyeOff aria-hidden className="size-4" />
        ) : (
          <Eye aria-hidden className="size-4" />
        )}
      </button>
    </div>
  );
});
PasswordInput.displayName = 'PasswordInput';
