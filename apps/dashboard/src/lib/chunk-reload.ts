/**
 * Pages are lazy chunks (DESIGN_SYSTEM §15). After a deploy removes the previous build's hashed
 * files (e.g. atomic hosting deploys), a tab still running the old build fails to load a page it
 * hasn't opened yet; Vite reports that as `vite:preloadError`. Reload once to pick up the new
 * build. A second failure within a minute is a real problem, so the normal error page shows
 * (it has its own Reload button). Without session storage there is no way to remember the first
 * reload, so it never reloads automatically there: an unconditional reload could loop forever.
 */
const KEY = 'ai-crm.chunk-reload';
const WINDOW_MS = 60_000;

export function installChunkReload(win: Window = window, now: () => number = Date.now): () => void {
  const onError = (event: Event) => {
    try {
      const last = Number(win.sessionStorage.getItem(KEY) ?? 0);
      if (now() - last < WINDOW_MS) return;
      win.sessionStorage.setItem(KEY, String(now()));
    } catch {
      return;
    }
    event.preventDefault();
    win.location.reload();
  };
  win.addEventListener('vite:preloadError', onError);
  return () => win.removeEventListener('vite:preloadError', onError);
}
