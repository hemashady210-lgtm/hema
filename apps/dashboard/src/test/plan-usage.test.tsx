import { screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { PlanUsage } from '@/features/overview/PlanUsage';
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

// A minute short of d whole days: the card rounds days up, so this reads as exactly d.
const inDays = (d: number) => new Date(Date.now() + d * 86_400_000 - 60_000).toISOString();

function render(role: 'owner' | 'agent' = 'owner') {
  localStorage.setItem('ai-crm.locale', 'en');
  supabaseMock.setSession({ user: { id: 'u-1', email: 'u1@test.local' }, access_token: 't' });
  const value = {
    workspace: WS,
    role,
    memberships: [{ role, joined_at: '', workspace: WS }],
  };
  return renderWithProviders(
    <WorkspaceContext.Provider value={value}>
      <MemoryRouter>
        <PlanUsage />
      </MemoryRouter>
    </WorkspaceContext.Provider>,
  );
}

beforeEach(() => {
  supabaseMock.resetErrors();
  supabaseMock.tableData.subscriptions = [
    { status: 'trialing', trial_ends_at: inDays(5), current_period_end: null },
  ];
  supabaseMock.tableData.workspace_members = [
    { user_id: 'u-1', role: 'owner', created_at: '2026-11-01T00:00:00Z' },
    { user_id: 'u-2', role: 'agent', created_at: '2026-11-02T00:00:00Z' },
  ];
  supabaseMock.tableData.profiles = [
    // The signed-in profile's locale wins over local storage (auth sync), so pin it to English.
    { id: 'u-1', full_name: 'One', email: 'u1@test.local', locale: 'en', theme: 'dark' },
    { id: 'u-2', full_name: 'Two', email: 'u2@test.local', locale: 'en', theme: 'dark' },
  ];
  supabaseMock.tableData.workspace_invitations = [];
  supabaseMock.tableData.usage_periods = null;
  supabaseMock.rpcData.get_workspace_entitlements = { max_users: 5, ai_replies_per_period: 100 };
});

afterEach(() => {
  supabaseMock.resetErrors();
  supabaseMock.setSession(null);
});

describe('Plan & usage (real data only)', () => {
  it('shows trial days, seats against the plan limit and the AI allowance', async () => {
    render();
    const plan = await screen.findByTestId('kpi-plan');
    expect(await within(plan).findByText('5')).toHaveClass('sr-only');
    const seats = screen.getByTestId('kpi-seats');
    expect(await within(seats).findByText('of 5')).toBeInTheDocument();
    expect(within(seats).getByRole('meter')).toHaveAttribute('aria-valuenow', '2');
    // No metered reply yet: an empty state with the real allowance — not "0 of 100".
    const ai = screen.getByTestId('kpi-ai');
    expect(await within(ai).findByText('No AI replies yet this period')).toBeInTheDocument();
    expect(within(ai).getByText('Allowance: 100 replies per period.')).toBeInTheDocument();
    expect(within(ai).queryByRole('meter')).toBeNull();
  });

  it('shows the open usage period when one exists', async () => {
    supabaseMock.tableData.usage_periods = [
      { ai_replies_used: 42, ai_replies_included: 100, period_end: inDays(20) },
    ];
    render();
    const ai = await screen.findByTestId('kpi-ai');
    expect(await within(ai).findByText('of 100')).toBeInTheDocument();
    expect(within(ai).getByRole('meter')).toHaveAttribute('aria-valuenow', '42');
    // Only open periods are read (same rule as the database's current period).
    expect(
      supabaseMock.calls.some(
        (c) => c.table === 'usage_periods' && c.op === 'is' && c.args[0] === 'closed_at',
      ),
    ).toBe(true);
  });

  it('never shows "Active" for a missing subscription: an explicit empty state instead', async () => {
    supabaseMock.tableData.subscriptions = null;
    render();
    const plan = await screen.findByTestId('kpi-plan');
    expect(await within(plan).findByText('No active plan')).toBeInTheDocument();
    expect(within(plan).queryByText('Active')).toBeNull();
  });

  it('maps billing statuses to their own labels (past due is not "Active")', async () => {
    supabaseMock.tableData.subscriptions = [
      { status: 'past_due', trial_ends_at: null, current_period_end: inDays(3) },
    ];
    render();
    const plan = await screen.findByTestId('kpi-plan');
    expect(await within(plan).findByText('Payment failed')).toBeInTheDocument();
    expect(within(plan).queryByText('Active')).toBeNull();
  });

  it('shows a retryable error — not defaults — when queries fail', async () => {
    supabaseMock.tableErrors.subscriptions = { message: 'boom' };
    supabaseMock.tableErrors.usage_periods = { message: 'boom' };
    supabaseMock.rpcErrors.get_workspace_entitlements = { message: 'boom' };
    render();
    for (const id of ['kpi-plan', 'kpi-seats', 'kpi-ai']) {
      const card = await screen.findByTestId(id);
      expect(await within(card).findByText('Couldn’t load this right now.')).toBeInTheDocument();
      expect(within(card).getByRole('button', { name: 'Try again' })).toBeInTheDocument();
      expect(within(card).queryByText('no limit')).toBeNull();
      expect(within(card).queryByText(/^of /)).toBeNull();
    }
  });

  it('says the limit is unknown when the entitlement is missing (never "no limit")', async () => {
    supabaseMock.rpcData.get_workspace_entitlements = { ai_replies_per_period: 100 };
    render();
    const seats = await screen.findByTestId('kpi-seats');
    expect(await within(seats).findByText('Limit not available right now')).toBeInTheDocument();
    expect(within(seats).queryByText('no limit')).toBeNull();
  });
});
