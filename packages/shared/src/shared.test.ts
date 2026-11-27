import { describe, expect, it } from 'vitest';
import {
  API_ERRORS,
  can,
  canLeave,
  canManageMember,
  createInvitationSchema,
  createWorkspaceSchema,
  INVITATION_TOKEN_PATTERN,
  maskEmail,
  passwordSchema,
  passwordStrength,
  safeRedirectPath,
  signUpSchema,
  slugify,
  SLUG_PATTERN,
  WORKSPACE_ROLES,
} from './index.ts';

describe('roles & capabilities', () => {
  it('matches the ARCHITECTURE §3 matrix for member management', () => {
    expect(WORKSPACE_ROLES.filter((r) => can(r, 'members.invite'))).toEqual(['owner', 'admin']);
    expect(WORKSPACE_ROLES.filter((r) => can(r, 'inbox.reply'))).toEqual([
      'owner',
      'admin',
      'agent',
    ]);
    expect(WORKSPACE_ROLES.filter((r) => can(r, 'workspace.transfer'))).toEqual(['owner']);
    expect(WORKSPACE_ROLES.every((r) => can(r, 'workspace.view'))).toBe(true);
    expect(can(null, 'workspace.view')).toBe(false);
  });

  it('canManageMember: never the owner, never yourself, only owner/admin', () => {
    const owner = { userId: 'o', role: 'owner' as const };
    const admin = { userId: 'a', role: 'admin' as const };
    const agent = { userId: 'g', role: 'agent' as const };
    expect(canManageMember(owner, admin)).toBe(true);
    expect(canManageMember(admin, agent)).toBe(true);
    expect(canManageMember(admin, { userId: 'a2', role: 'admin' })).toBe(true);
    expect(canManageMember(admin, owner)).toBe(false);
    expect(canManageMember(admin, admin)).toBe(false);
    expect(canManageMember(agent, { userId: 'v', role: 'viewer' })).toBe(false);
    expect(canLeave(owner)).toBe(false);
    expect(canLeave(agent)).toBe(true);
  });
});

describe('slugify', () => {
  it('builds a valid slug from Latin names', () => {
    expect(slugify('  Al Diwan Café & Grill ')).toBe('al-diwan-cafe-grill');
    expect(SLUG_PATTERN.test(slugify('Al Diwan Café & Grill'))).toBe(true);
  });
  it('falls back to a random suffix for Arabic names', () => {
    const s = slugify('مطعم الديوان', () => 0.5);
    expect(s).toMatch(/^ws-[a-z0-9]{5}$/);
    expect(SLUG_PATTERN.test(s)).toBe(true);
  });
  it('pads very short names', () => {
    expect(SLUG_PATTERN.test(slugify('A', () => 0.1))).toBe(true);
  });
});

describe('auth helpers', () => {
  it('password rules mirror config.toml (8+, letters and digits)', () => {
    expect(passwordSchema.safeParse('abc12345').success).toBe(true);
    expect(passwordSchema.safeParse('كلمةسر12').success).toBe(true);
    expect(passwordSchema.safeParse('abcdefgh').error?.issues[0]?.message).toBe(
      'validation.password_digit',
    );
    expect(passwordSchema.safeParse('12345678').error?.issues[0]?.message).toBe(
      'validation.password_letter',
    );
    expect(passwordSchema.safeParse('ab1').error?.issues[0]?.message).toBe(
      'validation.password_min',
    );
  });
  it('sign-up requires terms and a valid email', () => {
    const r = signUpSchema.safeParse({
      full_name: 'S',
      email: 'bad',
      accept_terms: false,
    });
    expect(r.success).toBe(false);
    const messages = r.error?.issues.map((i) => i.message).sort();
    expect(messages).toEqual(['validation.accept_terms', 'validation.email']);
  });
  it('strength grows with length and variety', () => {
    expect(passwordStrength('')).toBe(0);
    expect(passwordStrength('abc12345')).toBe(2);
    expect(passwordStrength('Abc12345!longer')).toBe(4);
  });
  it('safeRedirectPath blocks open redirects', () => {
    expect(safeRedirectPath('/w/demo/settings?tab=members')).toBe('/w/demo/settings?tab=members');
    for (const bad of [
      'https://evil.com',
      '//evil.com',
      '/\\evil.com',
      'evil',
      '/x\u0000y',
      null,
      undefined,
    ]) {
      expect(safeRedirectPath(bad, '/home')).toBe('/home');
    }
  });
});

describe('API schemas', () => {
  it('create workspace normalizes slug and validates fields', () => {
    const ok = createWorkspaceSchema.parse({
      name: ' Diwan ',
      slug: 'Diwan-Cafe',
      category: 'cafe',
      country_code: 'SA',
      timezone: 'Asia/Riyadh',
      default_locale: 'ar',
    });
    expect(ok).toMatchObject({ name: 'Diwan', slug: 'diwan-cafe' });
    expect(createWorkspaceSchema.safeParse({ ...ok, slug: '-x' }).success).toBe(false);
    expect(createWorkspaceSchema.safeParse({ ...ok, category: 'casino' }).success).toBe(false);
  });
  it('invitations cannot grant owner and default to ar', () => {
    expect(createInvitationSchema.safeParse({ email: 'a@b.co', role: 'owner' }).success).toBe(
      false,
    );
    expect(createInvitationSchema.parse({ email: ' A@B.co ', role: 'agent' })).toEqual({
      email: 'A@B.co',
      role: 'agent',
      locale: 'ar',
    });
  });
  it('every error code has a status and both languages', () => {
    for (const [code, e] of Object.entries(API_ERRORS)) {
      expect(e.status, code).toBeGreaterThanOrEqual(400);
      expect(e.ar.length, code).toBeGreaterThan(0);
      expect(e.en.length, code).toBeGreaterThan(0);
    }
  });
  it('token pattern and email masking', () => {
    expect(INVITATION_TOKEN_PATTERN.test('a'.repeat(43))).toBe(true);
    expect(INVITATION_TOKEN_PATTERN.test('a'.repeat(42))).toBe(false);
    expect(maskEmail('sara@example.com')).toBe('s***@example.com');
    expect(maskEmail('x')).toBe('***');
  });
});
