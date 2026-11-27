import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { UserMenu } from '@/features/shell/UserMenu';
import { supabaseMock } from './supabase-mock';
import { renderWithProviders } from './render';

beforeEach(() => {
  localStorage.setItem('ai-crm.locale', 'en');
  localStorage.setItem('ai-crm.theme', 'dark');
  supabaseMock.calls.length = 0;
  supabaseMock.tableData.profiles = {
    id: 'u1',
    email: 'sara@diwan.example',
    full_name: 'Sara Al-Harbi',
    avatar_path: null,
    locale: 'en',
    theme: 'dark',
  };
  supabaseMock.setSession({ user: { id: 'u1', email: 'sara@diwan.example' }, access_token: 't' });
});

afterEach(() => supabaseMock.setSession(null));

const profileUpdates = () =>
  supabaseMock.calls
    .filter((c) => c.table === 'profiles' && c.op === 'update')
    .map((c) => c.args[0]);

describe('user menu preferences (review finding 1)', () => {
  it('saves the appearance chosen in the menu to the profile, not only on this device', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MemoryRouter>
        <UserMenu slug="diwan" />
      </MemoryRouter>,
    );
    // Wait for the profile to load, so the menu acts on a signed-in profile.
    await screen.findByText('SA');
    await user.click(screen.getByRole('button', { name: 'Account menu' }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'Light' }));
    await waitFor(() => expect(profileUpdates()).toContainEqual({ theme: 'light' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  });

  it('saves the language switch to the profile too', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MemoryRouter>
        <UserMenu slug="diwan" />
      </MemoryRouter>,
    );
    await screen.findByText('SA');
    await user.click(screen.getByRole('button', { name: 'Account menu' }));
    await user.click(await screen.findByRole('menuitem', { name: 'العربية' }));
    await waitFor(() => expect(profileUpdates()).toContainEqual({ locale: 'ar' }));
  });
});
