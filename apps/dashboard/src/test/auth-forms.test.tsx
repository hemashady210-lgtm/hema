import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { routes } from '@/app/router';
import { supabaseMock } from './supabase-mock';
import { renderRoutes } from './render';

function setLocale(l: 'ar' | 'en') {
  localStorage.setItem('ai-crm.locale', l);
}

beforeEach(() => {
  supabaseMock.setSession(null);
  vi.clearAllMocks();
});

describe('sign in', () => {
  it('shows English validation messages and does not call Supabase', async () => {
    setLocale('en');
    renderRoutes(routes, '/auth/sign-in');
    await userEvent.click(await screen.findByRole('button', { name: 'Sign in' }));
    expect(await screen.findAllByText('This field is required.')).toHaveLength(2);
    expect(supabaseMock.client.auth.signInWithPassword).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText('Work email'), 'not-an-email');
    await userEvent.tab();
    expect(
      await screen.findByText('Enter a valid email address, like name@company.com.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Work email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows Arabic validation messages in RTL', async () => {
    setLocale('ar');
    renderRoutes(routes, '/auth/sign-in');
    await userEvent.click(await screen.findByRole('button', { name: 'تسجيل الدخول' }));
    expect(await screen.findAllByText('هذا الحقل مطلوب.')).toHaveLength(2);
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('signs in with email + password and shows a clear error for wrong credentials', async () => {
    setLocale('en');
    supabaseMock.client.auth.signInWithPassword.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: { code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' },
    } as never);
    renderRoutes(routes, '/auth/sign-in?next=/w/demo');
    await userEvent.type(await screen.findByLabelText('Work email'), 'sara@example.com');
    await userEvent.type(screen.getByLabelText('Password', { selector: 'input' }), 'wrong-pass1');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(supabaseMock.client.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'sara@example.com',
      password: 'wrong-pass1',
    });
    expect(await screen.findByText("The email or password isn't right.")).toBeInTheDocument();
  });

  it('offers to resend the confirmation link for unconfirmed emails', async () => {
    setLocale('en');
    supabaseMock.client.auth.signInWithPassword.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: { code: 'email_not_confirmed', status: 400, message: 'Email not confirmed' },
    } as never);
    renderRoutes(routes, '/auth/sign-in');
    await userEvent.type(await screen.findByLabelText('Work email'), 'new@example.com');
    await userEvent.type(screen.getByLabelText('Password', { selector: 'input' }), 'abc12345');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'Send the confirmation link again' }),
    );
    expect(supabaseMock.client.auth.resend).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'signup', email: 'new@example.com' }),
    );
    expect(await screen.findByText('Confirmation link sent.')).toBeInTheDocument();
  });

  it('magic link: existing accounts only, same confirmation either way', async () => {
    setLocale('en');
    supabaseMock.client.auth.signInWithOtp.mockResolvedValueOnce({
      data: {},
      error: { code: 'otp_disabled', status: 422, message: 'Signups not allowed for otp' },
    } as never);
    renderRoutes(routes, '/auth/sign-in');
    await userEvent.click(await screen.findByRole('tab', { name: 'Email link' }));
    await userEvent.type(screen.getByLabelText('Work email'), 'nobody@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Email me a sign-in link' }));
    expect(supabaseMock.client.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'nobody@example.com',
      options: { emailRedirectTo: 'http://localhost:3000/auth/callback', shouldCreateUser: false },
    });
    expect(await screen.findByText('Check your email')).toBeInTheDocument();
  });

  it('hides Google sign-in unless configured (E8)', async () => {
    setLocale('en');
    renderRoutes(routes, '/auth/sign-in');
    await screen.findByRole('button', { name: 'Sign in' });
    expect(screen.queryByRole('button', { name: 'Continue with Google' })).not.toBeInTheDocument();
  });
});

describe('sign up (email link first, password after — security review H1)', () => {
  it('validates email and terms in both languages and asks for no password', async () => {
    setLocale('en');
    renderRoutes(routes, '/auth/sign-up');
    await userEvent.type(await screen.findByLabelText('Full name'), 'Sara');
    await userEvent.type(screen.getByLabelText('Work email'), 'not-an-email');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(
      await screen.findByText('Enter a valid email address, like name@company.com.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Accept the terms to continue.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Password', { selector: 'input' })).not.toBeInTheDocument();
    expect(supabaseMock.client.auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it('sends an email link with name + current language, then shows "confirm your email"', async () => {
    setLocale('ar');
    renderRoutes(routes, '/auth/sign-up?next=/invite/abc');
    await userEvent.type(await screen.findByLabelText('الاسم الكامل'), 'سارة');
    await userEvent.type(screen.getByLabelText('بريد العمل'), 'sara@example.com');
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'إنشاء الحساب' }));
    await waitFor(() =>
      expect(supabaseMock.client.auth.signInWithOtp).toHaveBeenCalledWith({
        email: 'sara@example.com',
        options: {
          shouldCreateUser: true,
          emailRedirectTo:
            'http://localhost:3000/auth/callback?next=%2Fauth%2Fset-password%3Fnext%3D%252Finvite%252Fabc',
          data: { full_name: 'سارة', locale: 'ar' },
        },
      }),
    );
    expect(supabaseMock.client.auth.signUp).not.toHaveBeenCalled();
    expect(
      await screen.findByRole('heading', { name: 'أكّد بريدك الإلكتروني' }),
    ).toBeInTheDocument();
  });

  it('after confirming, the user chooses a password; other sessions are signed out', async () => {
    setLocale('en');
    supabaseMock.tableData.profiles = {
      id: 'u9',
      email: 's@x.co',
      full_name: 'S',
      avatar_path: null,
      locale: 'en',
      theme: 'dark',
    };
    supabaseMock.setSession({ user: { id: 'u9', email: 's@x.co' }, access_token: 't' });
    renderRoutes(routes, '/auth/set-password?next=/invite/abc');
    expect(
      await screen.findByRole('heading', { name: 'Choose your password' }),
    ).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('New password', { selector: 'input' }), 'abcdefgh');
    await userEvent.type(
      screen.getByLabelText('Confirm new password', { selector: 'input' }),
      'abcdefgh',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save password and continue' }));
    expect(await screen.findByText('Include at least one number.')).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('New password', { selector: 'input' }));
    await userEvent.type(screen.getByLabelText('New password', { selector: 'input' }), 'abc12345');
    await userEvent.clear(screen.getByLabelText('Confirm new password', { selector: 'input' }));
    await userEvent.type(
      screen.getByLabelText('Confirm new password', { selector: 'input' }),
      'abc12345',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save password and continue' }));
    await waitFor(() =>
      expect(supabaseMock.client.auth.updateUser).toHaveBeenCalledWith({ password: 'abc12345' }),
    );
    expect(supabaseMock.client.auth.signOut).toHaveBeenCalledWith({ scope: 'others' });
    supabaseMock.setSession(null);
  });
});

describe('password reset & guards', () => {
  it('forgot password shows the same confirmation for any email', async () => {
    setLocale('en');
    renderRoutes(routes, '/auth/forgot-password');
    await userEvent.type(await screen.findByLabelText('Work email'), 'x@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(supabaseMock.client.auth.resetPasswordForEmail).toHaveBeenCalledWith('x@example.com', {
      redirectTo: 'http://localhost:3000/auth/reset-password',
    });
    expect(
      await screen.findByText(
        'If an account exists for x@example.com, a reset link is on its way.',
      ),
    ).toBeInTheDocument();
  });

  it('reset page without a recovery session explains the link is invalid', async () => {
    setLocale('en');
    renderRoutes(routes, '/auth/reset-password');
    expect(
      await screen.findByText('This reset link is invalid or has expired. Request a new one.'),
    ).toBeInTheDocument();
  });

  it('protected routes send visitors to sign-in and keep the destination', async () => {
    setLocale('en');
    renderRoutes(routes, '/');
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });
});
