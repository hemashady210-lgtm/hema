import type { ComponentType } from 'react';
import { createBrowserRouter, Navigate, Outlet, type RouteObject } from 'react-router';
import { FullPageLoader } from '@/components/full-page-loader';
import { NavigationProgress } from '@/components/navigation-progress';
import { AuthLayout } from '@/features/auth/AuthLayout';
import { RedirectIfAuthenticated, RequireAuth } from '@/features/auth/guards';
import { ALL_ITEMS, type SectionKey } from '@/features/shell/nav';
import { RouteError } from '@/features/system/RouteError';

/*
 * Pages load per route (H5, DESIGN_SYSTEM §15): the first paint ships only the router, auth
 * state, layouts' frames and the page being opened. `page()` maps a module's named export to
 * the route's Component.
 */
function page<M>(load: () => Promise<M>, pick: (m: M) => ComponentType) {
  return async () => ({ Component: pick(await load()) });
}

const signIn = page(
  () => import('@/features/auth/SignInPage'),
  (m) => m.SignInPage,
);
const signUp = page(
  () => import('@/features/auth/SignUpPage'),
  (m) => m.SignUpPage,
);
const forgot = page(
  () => import('@/features/auth/ForgotPasswordPage'),
  (m) => m.ForgotPasswordPage,
);
const checkEmail = page(
  () => import('@/features/auth/CheckEmailPage'),
  (m) => m.CheckEmailPage,
);
const resetPassword = page(
  () => import('@/features/auth/ResetPasswordPage'),
  (m) => m.ResetPasswordPage,
);
const setPassword = page(
  () => import('@/features/auth/ResetPasswordPage'),
  (m) => m.SetPasswordPage,
);
const callback = page(
  () => import('@/features/auth/AuthCallbackPage'),
  (m) => m.AuthCallbackPage,
);
const acceptInvite = page(
  () => import('@/features/members/AcceptInvitePage'),
  (m) => m.AcceptInvitePage,
);
const notFound = page(
  () => import('@/features/system/NotFoundPage'),
  (m) => m.NotFoundPage,
);
const notFoundInShell = page(
  () => import('@/features/system/NotFoundPage'),
  (m) =>
    function NotFoundInShell() {
      return <m.NotFoundPage inShell />;
    },
);

export const authRoutes: RouteObject = {
  path: '/auth',
  element: <AuthLayout />,
  children: [
    { index: true, element: <Navigate to="/auth/sign-in" replace /> },
    {
      element: <RedirectIfAuthenticated />,
      children: [
        { path: 'sign-in', lazy: signIn },
        { path: 'sign-up', lazy: signUp },
        { path: 'forgot-password', lazy: forgot },
      ],
    },
    { path: 'check-email', lazy: checkEmail },
    { path: 'reset-password', lazy: resetPassword },
    { path: 'set-password', lazy: setPassword },
    { path: 'callback', lazy: callback },
  ],
};

function comingSoon(section: Exclude<SectionKey, 'settings'>) {
  return async () => {
    const { ComingSoonPage } = await import('@/features/shell/ComingSoonPage');
    return { Component: () => <ComingSoonPage section={section} /> };
  };
}

const sectionRoutes: RouteObject[] = ALL_ITEMS.filter((i) => i.comingSoon && i.path !== '').map(
  (item) => ({
    path: item.path,
    lazy: comingSoon(item.key as Exclude<SectionKey, 'settings'>),
  }),
);

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    errorElement: <RouteError />,
    HydrateFallback: FullPageLoader,
    children: [
      authRoutes,
      // Public: the invitation link may be opened signed out.
      {
        path: '/invite/:token',
        element: <AuthLayout />,
        children: [{ index: true, lazy: acceptInvite }],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            path: '/',
            lazy: page(
              () => import('@/features/workspaces/WorkspaceLayout'),
              (m) => m.RootRedirect,
            ),
          },
          {
            path: '/onboarding/workspace',
            lazy: page(
              () => import('@/features/workspaces/CreateWorkspacePage'),
              (m) => m.CreateWorkspacePage,
            ),
          },
          {
            path: '/w/:slug',
            lazy: page(
              () => import('@/features/workspaces/WorkspaceLayout'),
              (m) => m.WorkspaceLayout,
            ),
            children: [
              {
                index: true,
                lazy: page(
                  () => import('@/features/overview/OverviewPage'),
                  (m) => m.OverviewPage,
                ),
              },
              ...sectionRoutes,
              {
                path: 'settings',
                lazy: page(
                  () => import('@/features/settings/SettingsLayout'),
                  (m) => m.SettingsLayout,
                ),
                children: [
                  {
                    index: true,
                    lazy: page(
                      () => import('@/features/settings/GeneralSettingsPage'),
                      (m) => m.GeneralSettingsPage,
                    ),
                  },
                  {
                    path: 'members',
                    lazy: page(
                      () => import('@/features/members/MembersPage'),
                      (m) => m.MembersPage,
                    ),
                  },
                ],
              },
              {
                path: 'account',
                lazy: page(
                  () => import('@/features/account/AccountPage'),
                  (m) => m.AccountPage,
                ),
              },
              { path: '*', lazy: notFoundInShell },
            ],
          },
          { path: '/admin', element: <AdminPlaceholder /> },
        ],
      },
      { path: '*', lazy: notFound },
    ],
  },
];

/** Root: a progress bar while a lazy page loads (route splitting), then the page. */
function RootLayout() {
  return (
    <>
      <NavigationProgress />
      <Outlet />
    </>
  );
}

/** Super Admin (P14) is not built; /admin sends platform admins back to their workspaces. */
function AdminPlaceholder() {
  return <Navigate to="/" replace />;
}

export const router = createBrowserRouter(routes);
