import {
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useId,
  type ReactElement,
  type ReactNode,
} from 'react';
import { CircleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Label } from './label';

interface FieldControlProps {
  id: string;
  'aria-describedby'?: string | undefined;
  'aria-invalid'?: true | undefined;
}

const FieldContext = createContext<FieldControlProps | null>(null);

/** For controls nested deeper than the direct child (e.g. a Select inside a form Controller). */
export function useFieldControl(): FieldControlProps | null {
  return useContext(FieldContext);
}

interface FieldProps {
  label: ReactNode;
  /** Translated error message (shown inline, announced to screen readers). */
  error?: string | undefined;
  hint?: ReactNode;
  /** Shown at the end of the label row (e.g. "Forgot password?"). */
  labelAside?: ReactNode;
  className?: string;
  children: ReactElement<Record<string, unknown>>;
}

/** Label above, control, hint/error below — programmatically associated (DESIGN_SYSTEM §11). */
export function Field({ label, error, hint, labelAside, className, children }: FieldProps) {
  const id = useId();
  const controlId = (children.props.id as string | undefined) ?? `${id}-control`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;
  const controlProps: FieldControlProps = {
    id: controlId,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
  };
  const control = isValidElement(children) ? cloneElement(children, { ...controlProps }) : children;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={controlId}>{label}</Label>
        {labelAside}
      </div>
      <FieldContext.Provider value={controlProps}>{control}</FieldContext.Provider>
      {error ? (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-footnote text-danger">
          <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={hintId} className="text-footnote text-text-tertiary">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
