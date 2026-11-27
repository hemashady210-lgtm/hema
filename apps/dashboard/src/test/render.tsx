import type { ReactElement, ReactNode } from 'react';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router';
import { QueryClient } from '@tanstack/react-query';
import { AppProviders } from '@/app/providers';

export function testQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

export function renderWithProviders(ui: ReactNode) {
  return render(<AppProviders queryClient={testQueryClient()}>{ui}</AppProviders>);
}

/** Renders routes inside the real provider tree with an in-memory router. */
export function renderRoutes(
  routes: RouteObject[],
  initialPath: string,
): ReturnType<typeof render> {
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] });
  return render(
    <AppProviders queryClient={testQueryClient()}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}

export type { ReactElement };
