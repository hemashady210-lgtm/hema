import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountPage } from '@/features/account/AccountPage';
import { supabaseMock } from './supabase-mock';
import { renderWithProviders } from './render';

beforeEach(() => {
  localStorage.setItem('ai-crm.locale', 'en');
  supabaseMock.tableData.profiles = {
    id: 'u1',
    email: 'sara@diwan.example',
    full_name: 'Sara Al-Harbi',
    avatar_path: null,
    locale: 'en',
    theme: 'dark',
  };
});

afterEach(() => supabaseMock.setSession(null));

describe('account page', () => {
  it('shows the saved name even when the profile loads after the page (review regression)', async () => {
    // The page mounts before the profile query resolves.
    supabaseMock.setSession({ user: { id: 'u1', email: 'sara@diwan.example' }, access_token: 't' });
    renderWithProviders(<AccountPage />);
    expect(await screen.findByDisplayValue('Sara Al-Harbi')).toBeInTheDocument();
  });

  it('keeps what the person typed when the profile arrives later', async () => {
    supabaseMock.setSession({ user: { id: 'u1', email: 'sara@diwan.example' }, access_token: 't' });
    renderWithProviders(<AccountPage />);
    const field = await screen.findByDisplayValue('Sara Al-Harbi');
    await userEvent.clear(field);
    await userEvent.type(field, 'Sara H.');
    expect(screen.getByDisplayValue('Sara H.')).toBeInTheDocument();
  });

  it('offers dark, light and system appearance as labelled radio options', async () => {
    renderWithProviders(<AccountPage />);
    const group = await screen.findByRole('radiogroup', { name: 'Appearance' });
    expect(group.querySelectorAll('[role="radio"]')).toHaveLength(3);
    expect(screen.getByRole('radio', { name: 'System' })).toBeInTheDocument();
  });
});
