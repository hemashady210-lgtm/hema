import { act, render, screen } from '@testing-library/react';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router';
import { vi } from 'vitest';
import { AppProviders } from '@/app/providers';
import { NavigationProgress } from '@/components/navigation-progress';
import { NotFoundPage } from '@/features/system/NotFoundPage';
import { installChunkReload } from '@/lib/chunk-reload';
import { testQueryClient } from './render';

function renderAt(entries: string[], index = entries.length - 1) {
  localStorage.setItem('ai-crm.locale', 'en');
  const router = createMemoryRouter(
    [
      { path: '/', element: <p>home</p> },
      { path: '*', element: <NotFoundPage /> },
    ],
    { initialEntries: entries, initialIndex: index },
  );
  render(
    <AppProviders queryClient={testQueryClient()}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}

describe('404 page', () => {
  it('offers only the way home on a fresh tab (nothing in-app to go back to)', () => {
    renderAt(['/nowhere']);
    expect(screen.getByRole('link', { name: 'Go to my workspaces' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });

  it('adds "Back" when the person arrived from another in-app page', () => {
    renderAt(['/', '/nowhere']);
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
  });
});

function fakeWindow() {
  const target = new EventTarget();
  const store = new Map<string, string>();
  const reload = vi.fn();
  const win = Object.assign(target, {
    location: { reload },
    sessionStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    },
  });
  return { win: win as unknown as Window, reload };
}

const preloadError = () => new Event('vite:preloadError', { cancelable: true });

describe('stale chunk after a deploy', () => {
  it('reloads once to pick up the new build, and not again within a minute', () => {
    const { win, reload } = fakeWindow();
    let now = 1_000_000;
    const off = installChunkReload(win, () => now);
    const first = preloadError();
    win.dispatchEvent(first);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(first.defaultPrevented).toBe(true);
    // The reload didn't help (real outage): let the error page show instead of looping.
    now += 10_000;
    const second = preloadError();
    win.dispatchEvent(second);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(second.defaultPrevented).toBe(false);
    // A later deploy can reload again.
    now += 60_000;
    win.dispatchEvent(preloadError());
    expect(reload).toHaveBeenCalledTimes(2);
    off();
    win.dispatchEvent(preloadError());
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('never reloads on its own when it cannot remember doing so (no reload loop)', () => {
    const { win, reload } = fakeWindow();
    Object.defineProperty(win, 'sessionStorage', {
      get() {
        throw new DOMException('blocked', 'SecurityError');
      },
    });
    installChunkReload(win, () => 1_000_000);
    const event = preloadError();
    win.dispatchEvent(event);
    expect(reload).not.toHaveBeenCalled();
    // Not prevented: Vite rethrows, the route error page shows with its Reload button.
    expect(event.defaultPrevented).toBe(false);
  });
});

describe('navigation progress', () => {
  it('shows a bar and announces loading only when a lazy page takes over 150 ms', async () => {
    vi.useFakeTimers();
    localStorage.setItem('ai-crm.locale', 'en');
    let finish: () => void = () => {};
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: (
            <>
              <NavigationProgress />
              <Outlet />
            </>
          ),
          children: [
            { index: true, element: <p>start</p> },
            {
              path: 'slow',
              lazy: () =>
                new Promise((resolve) => {
                  finish = () => resolve({ element: <p>slow page</p> });
                }),
            },
          ],
        },
      ],
      { initialEntries: ['/'] },
    );
    render(
      <AppProviders queryClient={testQueryClient()}>
        <RouterProvider router={router} />
      </AppProviders>,
    );
    const bar = screen.getByTestId('navigation-progress');
    expect(bar).toHaveAttribute('data-state', 'idle');
    act(() => void router.navigate('/slow'));
    act(() => vi.advanceTimersByTime(100));
    expect(bar).toHaveAttribute('data-state', 'idle');
    act(() => vi.advanceTimersByTime(100));
    expect(bar).toHaveAttribute('data-state', 'loading');
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
    await act(async () => finish());
    vi.useRealTimers();
    expect(await screen.findByText('slow page')).toBeInTheDocument();
    expect(bar).toHaveAttribute('data-state', 'idle');
  });
});
