// P3 acceptance journey (ROADMAP P3): sign up → verify email → create workspace → invite →
// accept (second user) → role-restricted view → switch language. Runs in Arabic (RTL) and
// English (LTR), with axe checks (0 critical).
import { expect, test, type Page } from '@playwright/test';
import {
  PASSWORD,
  emailLink,
  expectNoCriticalA11y,
  grantSeats,
  setLocale,
  uniqueEmail,
} from './helpers';

const T = {
  en: {
    fullName: 'Full name',
    email: 'Work email',
    newPassword: 'New password',
    confirmPassword: 'Confirm new password',
    savePassword: 'Save password and continue',
    createAccount: 'Create account',
    checkEmail: 'Confirm your email',
    createWsTitle: 'Create your workspace',
    wsName: 'Business name',
    category: 'Business type',
    cafe: 'Café',
    createWs: 'Create workspace',
    overview: 'Overview',
    comingSoon: 'Coming soon',
    settings: 'Settings',
    members: 'Members',
    invite: 'Invite member',
    inviteEmail: 'Email',
    agent: 'Agent',
    sendInvite: 'Send invitation',
    shareTitle: 'Share the invitation link',
    notConfigured: 'Email not configured',
    signUpToAccept: 'Create an account',
    accept: 'Accept and join',
    manageNotice: 'Only owners and admins can invite or manage members.',
    readOnlyNotice: 'Only owners and admins can change workspace details.',
    otherLanguage: 'العربية',
    dir: 'ltr',
  },
  ar: {
    fullName: 'الاسم الكامل',
    email: 'بريد العمل',
    newPassword: 'كلمة المرور الجديدة',
    confirmPassword: 'تأكيد كلمة المرور الجديدة',
    savePassword: 'حفظ كلمة المرور والمتابعة',
    createAccount: 'إنشاء الحساب',
    checkEmail: 'أكّد بريدك الإلكتروني',
    createWsTitle: 'أنشئ مساحة عملك',
    wsName: 'اسم النشاط التجاري',
    category: 'نوع النشاط',
    cafe: 'مقهى',
    createWs: 'إنشاء مساحة العمل',
    overview: 'نظرة عامة',
    comingSoon: 'قريبًا',
    settings: 'الإعدادات',
    members: 'الأعضاء',
    invite: 'دعوة عضو',
    inviteEmail: 'البريد الإلكتروني',
    agent: 'موظف خدمة',
    sendInvite: 'إرسال الدعوة',
    shareTitle: 'شارك رابط الدعوة',
    notConfigured: 'البريد غير مُعدّ',
    signUpToAccept: 'أنشئ حسابًا',
    accept: 'قبول والانضمام',
    manageNotice: 'يمكن للمالك والمسؤولين فقط دعوة الأعضاء وإدارتهم.',
    readOnlyNotice: 'يمكن للمالك والمسؤولين فقط تغيير تفاصيل مساحة العمل.',
    otherLanguage: 'English',
    dir: 'rtl',
  },
} as const;

/** Sign-up = email link first, password after (security review H1). */
async function signUp(page: Page, l: (typeof T)['en' | 'ar'], name: string, email: string) {
  await page.getByLabel(l.fullName).fill(name);
  await page.getByLabel(l.email).fill(email);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: l.createAccount }).click();
  await expect(page.getByRole('heading', { name: l.checkEmail })).toBeVisible();
  await page.goto(await emailLink(email));
  await expect(page).toHaveURL(/\/auth\/set-password/);
  await page.getByLabel(l.newPassword, { exact: true }).fill(PASSWORD);
  await page.getByLabel(l.confirmPassword, { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: l.savePassword }).click();
}

for (const locale of ['ar', 'en'] as const) {
  const l = T[locale];

  test(`P3 journey (${locale})`, async ({ browser }) => {
    const ownerEmail = uniqueEmail(`owner-${locale}`);
    const agentEmail = uniqueEmail(`agent-${locale}`);
    const wsName = locale === 'ar' ? 'مقهى الديوان' : 'Diwan Cafe';

    // 1. Owner signs up and verifies the email -------------------------------------------
    const ownerCtx = await browser.newContext();
    const owner = await ownerCtx.newPage();
    await setLocale(owner, locale);
    await owner.goto('/auth/sign-up');
    await expect(owner.locator('html')).toHaveAttribute('dir', l.dir);
    await expectNoCriticalA11y(owner, `sign-up ${locale}`);
    await signUp(owner, l, locale === 'ar' ? 'سارة المالكة' : 'Sara Owner', ownerEmail);

    // 2. First workspace ------------------------------------------------------------------
    await expect(owner.getByRole('heading', { name: l.createWsTitle })).toBeVisible();
    await owner.getByLabel(l.wsName).fill(wsName);
    // Arabic names get a random Latin slug suggestion; make it unique and readable.
    const slug = `e2e-${locale}-${Date.now().toString(36)}`;
    const slugInput = owner.locator('input[name="slug"]');
    await slugInput.fill(slug);
    await expect(owner.getByTestId('slug-status')).toHaveAttribute('class', /text-success/);
    await owner.getByRole('combobox', { name: l.category }).click();
    await owner.getByRole('option', { name: l.cafe }).click();
    await expect(owner.getByRole('listbox')).toHaveCount(0); // let the popover finish closing
    await expectNoCriticalA11y(owner, `create-workspace ${locale}`);
    await owner.getByRole('button', { name: l.createWs }).click();
    await expect(owner).toHaveURL(new RegExp(`/w/${slug}$`));
    await expect(owner.getByRole('heading', { name: l.overview, level: 1 })).toBeVisible();
    await expect(owner.getByTestId('trial-badge')).toBeVisible();
    await expectNoCriticalA11y(owner, `shell ${locale}`);

    // 3. Invite a teammate (email delivery not configured locally → copyable link) ---------
    await grantSeats(slug, 3);
    await owner.goto(`/w/${slug}/settings/members`);
    await owner.getByTestId('invite-button').click();
    const dialog = owner.getByRole('dialog');
    await dialog.getByLabel(l.inviteEmail).fill(agentEmail);
    await dialog.getByRole('radio', { name: new RegExp(l.agent) }).click();
    await dialog.getByRole('button', { name: l.sendInvite }).click();
    await expect(dialog.getByRole('heading', { name: l.shareTitle })).toBeVisible();
    await expect(owner.getByTestId('invite-result')).toHaveAttribute(
      'data-email-status',
      'not_configured',
    );
    const inviteUrl = await dialog.locator('#invite-link').inputValue();
    expect(inviteUrl).toMatch(/\/invite\/[A-Za-z0-9_-]{43}$/);
    await dialog.getByRole('button', { name: locale === 'ar' ? 'تم' : 'Done' }).click();
    await expect(owner.getByTestId('pending-invitation')).toContainText(agentEmail);
    await expect(owner.getByTestId('email-status')).toHaveText(l.notConfigured);
    await expectNoCriticalA11y(owner, `members ${locale}`);

    // 4. Teammate opens the link signed out, creates an account, verifies, accepts --------
    const agentCtx = await browser.newContext();
    const agent = await agentCtx.newPage();
    await setLocale(agent, locale);
    await agent.goto(inviteUrl);
    await expect(agent.getByTestId('accept-invite')).toContainText(wsName);
    await expectNoCriticalA11y(agent, `accept-invite ${locale}`);
    await agent.getByRole('link', { name: l.signUpToAccept }).click();
    await signUp(agent, l, locale === 'ar' ? 'خالد الموظف' : 'Khalid Agent', agentEmail);
    await expect(agent).toHaveURL(/\/invite\//);
    await agent.getByTestId('accept-button').click();
    await expect(agent).toHaveURL(new RegExp(`/w/${slug}$`));

    // 5. Role-restricted view: an agent sees members but cannot invite or manage ------------
    await agent.goto(`/w/${slug}/settings/members`);
    await expect(agent.getByText(l.manageNotice)).toBeVisible();
    await expect(agent.getByTestId('invite-button')).toHaveCount(0);
    await expect(agent.getByTestId('member-row')).toHaveCount(2);
    await expect(agent.getByTestId('pending-invitations')).toHaveCount(0);
    // Only one actions menu: the agent's own row (leave); none on the owner's row.
    await expect(agent.getByTestId('member-actions')).toHaveCount(1);
    await agent.goto(`/w/${slug}/settings`);
    await expect(agent.getByText(l.readOnlyNotice)).toBeVisible();
    await expect(agent.getByLabel(l.wsName)).toBeDisabled();

    // Owner sees the teammate as a member now.
    await owner.reload();
    await expect(owner.getByTestId('member-row')).toHaveCount(2);

    // 6. Switch language AR ⇄ EN without reload -------------------------------------------
    const other = locale === 'ar' ? 'ltr' : 'rtl';
    await agent.getByTestId('language-toggle').click();
    await expect(agent.locator('html')).toHaveAttribute('dir', other);
    await expect(
      agent.getByRole('heading', { name: T[locale === 'ar' ? 'en' : 'ar'].settings, level: 1 }),
    ).toBeVisible();
    await agent.reload();
    await expect(agent.locator('html')).toHaveAttribute('dir', other);

    // 7. The agent leaves: back to their (now empty) workspace list, no "not found" page.
    await agent.goto(`/w/${slug}/settings/members`);
    await agent.getByTestId('member-actions').click();
    await agent.getByRole('menuitem').click();
    await agent.getByRole('alertdialog').getByRole('button').last().click();
    await expect(agent).toHaveURL(/\/onboarding\/workspace$/);

    await ownerCtx.close();
    await agentCtx.close();
  });
}
