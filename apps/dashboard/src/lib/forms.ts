import { useForm, type DefaultValues, type FieldError, type FieldValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { TFunction } from 'i18next';
import type { z } from 'zod';

/** react-hook-form + the shared zod schemas (messages are i18n keys). */
export function useZodForm<S extends z.ZodType<FieldValues, FieldValues>>(
  schema: S,
  defaultValues: DefaultValues<z.input<S>>,
) {
  return useForm<z.input<S>, unknown, z.output<S>>({
    // The resolver's generics differ slightly between zod input/output; the runtime contract holds.
    resolver: zodResolver(schema as never) as never,
    defaultValues,
    mode: 'onTouched',
  });
}

/** Translates a field error whose message is an i18n key (`validation.*`). */
export function fieldError(t: TFunction, error: FieldError | undefined): string | undefined {
  if (!error?.message) return error ? t('validation.invalid') : undefined;
  const msg = error.message;
  return msg.startsWith('validation.') ? t(msg as 'validation.required') : msg;
}
