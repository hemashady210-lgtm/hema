import { createBrowserRouter, Navigate, Outlet, type RouteObject } from 'react-router';
import { AuthCallbackPage } from '@/features/auth/AuthCallbackPage';
import { AuthLayout } from '@/features/auth/AuthLayout';
import { CheckEmailPage } from '@/features/auth/CheckEmailPage';
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage';
import { RedirectIfAuthenticated, RequireAuth } from '@/features/auth/guards';
import { ResetPasswordPage, SetPasswordPage } from '@/features/auth/ResetPasswordPage';
import { SignInPage } from '@/features/auth/SignInPage';
import { SignUpPage } from '@/features/auth/SignUpPage';
import { AccountPage } from '@/features/account/AccountPage';
import { AcceptInvitePage } from '@/features/members/AcceptInvitePage';
import { MembersPage } from '@/features/members/MembersPage';
import { GeneralSettingsPage } from '@/features/settings/GeneralSettingsPage';
import { SettingsLayout } from '@/features/settings/SettingsLayout';
import { ComingSoonPage } from '@/features/shell/ComingSoonPage';
import { ALL_ITEMS } from '@/features/shell/nav';
import { NotFoundPage } from '@/features/system/NotFoundPage';
import { RouteError } from '@/features/system/RouteError';
import { CreateWorkspacePage } from '@/features/workspaces/CreateWorkspacePage';
import { RootRedirect, WorkspaceLayout } from '@/features/workspaces/WorkspaceLayout';

export const authRoutes: RouteObject = {
  path: '/auth',
  element: <AuthLayout />,
  children: [
    { index: true, element: <Navigate to="/auth/sign-in" replace /> },
    {
      element: <RedirectIfAuthenticated />,
      children: [
        { path: 'sign-in', element: <SignInPage /> },
        { path: 'sign-up', element: <SignUpPage /> },
        { path: 'forgot-password', element: <ForgotPasswordPage /> },
      ],
    },
    { path: 'check-email', element: <CheckEmailPage /> },
    { path: 'reset-password', element: <ResetPasswordPage /> },
    { path: 'set-password', element: <SetPasswordPage /> },
    { path: 'callback', element: <AuthCallbackPage /> },
  ],
};

const sectionRoutes: RouteObject[] = ALL_ITEMS.filter((i) => i.comingSoon && i.path !== '').map(
  (item) => ({
    path: item.path,
    element: <ComingSoonPage section={item.key as Exclude<typeof item.key, 'settings'>} />,
  }),
);

export const routes: RouteObject[] = [
  {
    element: <Outlet />,
    errorElement: <RouteError />,
    children: [
      authRoutes,
      // Public: the invitation link may be opened signed out.
      {
        path: '/invite/:token',
        element: <AuthLayout />,
        children: [{ index: true, element: <AcceptInvitePage /> }],
      },
      {
        element: <RequireAuth />,
        children: [
          { path: '/', element: <RootRedirect /> },
          { path: '/onboarding/workspace', element: <CreateWorkspacePage /> },
          {
            path: '/w/:slug',
            element: <WorkspaceLayout />,
            children: [
              { index: true, element: <ComingSoonPage section="overview" /> },
              ...sectionRoutes,
              {
                path: 'settings',
                element: <SettingsLayout />,
                children: [
                  { index: true, element: <GeneralSettingsPage /> },
                  { path: 'members', element: <MembersPage /> },
                ],
              },
              { path: 'account', element: <AccountPage /> },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
          { path: '/admin', element: <AdminPlaceholder /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

/** Super Admin (P14) is not built; /admin sends platform admins back to their workspaces. */
function AdminPlaceholder() {
  return <Navigate to="/" replace />;
}

export const router = createBrowserRouter(routes);
