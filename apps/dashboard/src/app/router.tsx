import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { AuthCallbackPage } from '@/features/auth/AuthCallbackPage';
import { AuthLayout } from '@/features/auth/AuthLayout';
import { CheckEmailPage } from '@/features/auth/CheckEmailPage';
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage';
import { RedirectIfAuthenticated, RequireAuth } from '@/features/auth/guards';
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage';
import { SignInPage } from '@/features/auth/SignInPage';
import { SignUpPage } from '@/features/auth/SignUpPage';
import { NotFoundPage } from '@/features/system/NotFoundPage';

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
    { path: 'callback', element: <AuthCallbackPage /> },
  ],
};

export const routes: RouteObject[] = [
  authRoutes,
  { path: '/', element: <RequireAuth />, children: [{ index: true, element: <NotFoundPage /> }] },
  { path: '*', element: <NotFoundPage /> },
];

export const router = createBrowserRouter(routes);
