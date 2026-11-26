// Role-based UI: actions are hidden or disabled by role (the database is the real enforcement).
import { screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { WorkspaceRole } from '@ai-crm/shared';
import { MembersPage } from '@/features/members/MembersPage';
import { GeneralSettingsPage } from '@/features/settings/GeneralSettingsPage';
import { WorkspaceContext } from '@/features/workspaces/context';
import type { Workspace } from '@/features/workspaces/queries';
import { supabaseMock } from './supabase-mock';
import { renderWithProviders } from './render';

const WS: Workspace = {
  id: 'ws-1',
  name: 'Diwan Cafe',
  slug: 'diwan',
  category: 'cafe',
  country_code: 'SA',
  timezone: 'Asia/Riyadh',
  default_locale: 'en',
  status: 'active',
};

const PEOPLE = [
  { user_id: 'u-owner', role: 'owner', name: 'Olivia Owner' },
  { user_id: 'u-admin', role: 'admin', name: 'Adam Admin' },
  { user_id: 'u-agent', role: 'agent', name: 'Aya Agent' },
  { user_id: 'u-viewer', role: 'viewer', name: 'Vik Viewer' },
] as const;

function setup(me: (typeof PEOPLE)[number], workspace: Workspace = WS) {
  localStorage.setItem('ai-crm.locale', 'en');
  supabaseMock.tableData.workspace_members = PEOPLE.map((p) => ({
    user_id: p.user_id,
    role: p.role,
    created_at: '2026-11-01T00:00:00Z',
  }));
  supabaseMock.tableData.profiles = PEOPLE.map((p) => ({
    id: p.user_id,
    full_name: p.name,
    email: `${p.user_id}@test.local`,
    locale: 'en',
    theme: 'dark',
    avatar_path: null,
  }));
  supabaseMock.tableData.workspace_invitations = [
    {
      id: 'inv-1',
      email: 'new@test.local',
      role: 'viewer',
      expires_at: '2099-01-01T00:00:00Z',
      created_at: '2026-11-01T00:00:00Z',
      email_status: 'not_configured',
      locale: 'en',
    },
  ];
  supabaseMock.rpcData.get_workspace_entitlements = { max_users: 5 };
  supabaseMock.setSession({
    user: { id: me.user_id, email: `${me.user_id}@test.local` },
    access_token: 't',
  });
  const value = {
    workspace,
    role: me.role as WorkspaceRole,
    memberships: [{ role: me.role as WorkspaceRole, joined_at: '', workspace }],
  };
  return (ui: React.ReactNode) =>
    renderWithProviders(
      <WorkspaceContext.Provider value={value}>
        <MemoryRouter>{ui}</MemoryRouter>
      </WorkspaceContext.Provider>,
    );
}

async function rows() {
  await waitFor(() => expect(screen.getAllByTestId('member-row')).toHaveLength(4));
  return Object.fromEntries(
    screen
      .getAllByTestId('member-row')
      .map((r) => [r.getAttribute('data-role'), within(r).queryByTestId('member-actions')]),
  );
}

describe('members page by role', () => {
  it('owner: can invite, manage everyone except themselves, sees pending invitations', async () => {
    setup(PEOPLE[0])(<MembersPage />);
    const actions = await rows();
    expect(screen.getByTestId('invite-button')).toBeInTheDocument();
    expect(actions.owner).toBeNull();
    expect(actions.admin).not.toBeNull();
    expect(actions.agent).not.toBeNull();
    expect(actions.viewer).not.toBeNull();
    expect(await screen.findByTestId('pending-invitation')).toHaveTextContent('new@test.local');
    expect(screen.getByTestId('email-status')).toHaveTextContent('Email not configured');
    expect(screen.getByTestId('seats')).toHaveTextContent('5 of 5 seats used');
  });

  it('admin: manages admins/agents/viewers but never the owner; can leave', async () => {
    setup(PEOPLE[1])(<MembersPage />);
    const actions = await rows();
    expect(screen.getByTestId('invite-button')).toBeInTheDocument();
    expect(actions.owner).toBeNull();
    expect(actions.admin).not.toBeNull(); // own row: leave only
    expect(actions.agent).not.toBeNull();
  });

  it.each([PEOPLE[2], PEOPLE[3]])(
    '$role: no invite, no management, only "leave" on their own row',
    async (me) => {
      setup(me)(<MembersPage />);
      const actions = await rows();
      expect(screen.queryByTestId('invite-button')).not.toBeInTheDocument();
      expect(
        screen.getByText('Only owners and admins can invite or manage members.'),
      ).toBeInTheDocument();
      expect(screen.queryByTestId('pending-invitations')).not.toBeInTheDocument();
      const withActions = Object.entries(actions)
        .filter(([, a]) => a !== null)
        .map(([r]) => r);
      expect(withActions).toEqual([me.role]);
    },
  );

  it('read-only workspace: even the owner cannot invite', async () => {
    setup(PEOPLE[0], { ...WS, status: 'read_only' })(<MembersPage />);
    await rows();
    expect(screen.queryByTestId('invite-button')).not.toBeInTheDocument();
  });
});

describe('workspace settings by role', () => {
  it('viewer sees a read-only form with an explanation', async () => {
    setup(PEOPLE[3])(<GeneralSettingsPage />);
    expect(
      await screen.findByText('Only owners and admins can change workspace details.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Business name')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Transfer ownership' })).not.toBeInTheDocument();
  });

  it('admin can edit but cannot transfer ownership', async () => {
    setup(PEOPLE[1])(<GeneralSettingsPage />);
    expect(await screen.findByLabelText('Business name')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Transfer ownership' })).not.toBeInTheDocument();
  });

  it('owner sees the ownership transfer action', async () => {
    setup(PEOPLE[0])(<GeneralSettingsPage />);
    expect(await screen.findByRole('button', { name: 'Transfer ownership' })).toBeInTheDocument();
  });
});
