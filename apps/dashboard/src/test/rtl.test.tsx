import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageToggle } from '@/components/language-toggle';
import { supabaseMock } from './supabase-mock';
import { renderWithProviders } from './render';

describe('language & direction switching', () => {
  beforeEach(() => {
    supabaseMock.setSession(null);
    supabaseMock.calls.length = 0;
  });

  it('starts in Arabic RTL by default and switches to English LTR without reload', async () => {
    localStorage.setItem('ai-crm.locale', 'ar');
    renderWithProviders(<LanguageToggle />);
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
    const button = screen.getByTestId('language-toggle');
    expect(button).toHaveTextContent('English');

    await userEvent.click(button);
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.lang).toBe('en');
    expect(localStorage.getItem('ai-crm.locale')).toBe('en');
    expect(screen.getByTestId('language-toggle')).toHaveTextContent('العربية');

    await userEvent.click(screen.getByTestId('language-toggle'));
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('saves the choice on the profile when signed in', async () => {
    localStorage.setItem('ai-crm.locale', 'en');
    supabaseMock.tableData.profiles = {
      id: 'u1',
      email: 'a@b.co',
      full_name: 'A',
      avatar_path: null,
      locale: 'en',
      theme: 'dark',
    };
    supabaseMock.setSession({ user: { id: 'u1', email: 'a@b.co' }, access_token: 't' });
    renderWithProviders(<LanguageToggle />);
    await waitFor(() =>
      expect(supabaseMock.calls.some((c) => c.table === 'profiles' && c.op === 'select')).toBe(
        true,
      ),
    );
    await userEvent.click(screen.getByTestId('language-toggle'));
    await waitFor(() =>
      expect(supabaseMock.calls).toContainEqual({
        table: 'profiles',
        op: 'update',
        args: [{ locale: 'ar' }],
      }),
    );
    expect(document.documentElement.dir).toBe('rtl');
  });

  it("applies the profile's saved language after sign-in", async () => {
    localStorage.setItem('ai-crm.locale', 'en');
    supabaseMock.tableData.profiles = {
      id: 'u2',
      email: 'b@b.co',
      full_name: 'B',
      avatar_path: null,
      locale: 'ar',
      theme: 'light',
    };
    supabaseMock.setSession({ user: { id: 'u2', email: 'b@b.co' }, access_token: 't' });
    renderWithProviders(<LanguageToggle />);
    await waitFor(() => expect(document.documentElement.lang).toBe('ar'));
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
