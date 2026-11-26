// Structured JSON logs (one line per event). Never pass tokens, keys or email addresses.
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  log(level: LogLevel, msg: string, fields?: Record<string, unknown>): void;
  child(fields: Record<string, unknown>): Logger;
}

export function createLogger(base: Record<string, unknown> = {}, sink = console.log): Logger {
  return {
    log(level, msg, fields) {
      sink(JSON.stringify({ ts: new Date().toISOString(), level, msg, ...base, ...fields }));
    },
    child(fields) {
      return createLogger({ ...base, ...fields }, sink);
    },
  };
}
