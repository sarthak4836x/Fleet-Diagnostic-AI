import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

// One end-to-end pass over the paths that have broken before: sample data leaking to a customer,
// adding a vehicle and scanning it, switching operators, and suspending a fleet.
// The scenarios share state (the fleet and owner created in step 2), so they run in order.

const DEV = { id: 'sarthak', password: 'Test-developer-1' };
const DIRECTOR = { id: 'director', email: 'm.vance@fleetdiag-logistics.com', password: 'Test-director-1' };
// A retry runs in a fresh worker against the same server, so each attempt needs its own fleet
// and owner: re-creating the same owner would be refused as a duplicate.
const RUN = Date.now().toString(36);
const OWNER_EMAIL = `asha-${RUN}@acme.example`;
const FLEET_NAME = `Acme Haulage ${RUN}`;
const VEHICLE_ID = 'ACME-001';
const SUSPENDED = 'This fleet has been suspended.';

// Samples the page text every 50 ms while sampling is on, and records any sample-truck id it sees.
// Catches sample data that flashes up and disappears before an assertion could look at it.
const SAMPLER = `(() => {
  if (window.__sampler) return;
  window.__sampler = 1;
  setInterval(() => {
    try {
      if (sessionStorage.getItem('__on') !== '1') return;
      const text = document.body ? document.body.innerText : '';
      const m = text.match(/TATA-[A-Z0-9-]*/);
      if (m) {
        const hits = JSON.parse(sessionStorage.getItem('__hits') || '[]');
        if (hits.length < 3000) hits.push(m[0]);
        sessionStorage.setItem('__hits', JSON.stringify(hits));
      }
    } catch (e) {}
  }, 50);
})()`;

const pageErrors: string[] = [];

async function newPage(browser: Browser, sampler = false): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  if (sampler) await context.addInitScript(SAMPLER);
  const page = await context.newPage();
  page.on('pageerror', (err) => pageErrors.push(`${page.url()}: ${err.message}`));
  return { context, page };
}

async function openSignIn(page: Page) {
  await page.goto('/');
  await expect(page.locator('#welcome-login-identifier')).toBeVisible();
}

async function signIn(page: Page, id: string, password: string) {
  await page.fill('#welcome-login-identifier', id);
  await page.fill('#welcome-login-password', password);
  await page.click('#welcome-login-submit-btn');
  await expect(page.locator('#welcome-login-identifier')).toHaveCount(0);
}

// Visible text only: the vehicle picker also holds the ids in hidden <option> elements.
async function expectShows(page: Page, text: string | RegExp) {
  await expect(page.locator('body')).toContainText(text, { useInnerText: true });
}

async function expectSampleTrucks(page: Page) {
  await expectShows(page, /TATA-/);
}

async function openFleets(page: Page) {
  await page.locator('button[aria-label^="Fleets"]:visible').first().click();
  const dialog = page.locator('[role=dialog][aria-label=Fleets]');
  await expect(dialog).toBeVisible();
  return dialog;
}

// The demo-role shortcuts (and the "Custom Credentials" toggle beside them) are shown only to
// someone signed in to the demo fleet; a customer goes straight to the credentials form.
async function switchOperator(page: Page, email: string, password: string, fromDemoFleet: boolean) {
  await page.locator('[aria-label="Account menu"]:visible').first().click();
  await page.locator('button:visible', { hasText: 'Switch Operator' }).first().click();
  const customToggle = page.locator('button', { hasText: 'Custom Credentials' });
  if (fromDemoFleet) {
    await customToggle.first().click();
  } else {
    await expect(page.locator('input[placeholder="Enter account password"]')).toBeVisible();
    await expect(customToggle).toHaveCount(0);
  }
  await page.fill('input[placeholder="technician@fleet-logistics.com"]', email);
  await page.fill('input[placeholder="Enter account password"]', password);
  await page.locator('form button[type=submit]:visible').first().click();
}

test.describe.serial('smoke', () => {
  let dev: Page;
  let owner: Page;
  let ownerPassword = '';
  const contexts: BrowserContext[] = [];

  test.beforeAll(async ({ browser }) => {
    const d = await newPage(browser);
    const o = await newPage(browser, true);
    contexts.push(d.context, o.context);
    dev = d.page;
    owner = o.page;
  });

  test.afterAll(async () => {
    for (const c of contexts) await c.close();
  });

  test.afterEach(() => {
    const errors = pageErrors.splice(0);
    expect(errors, 'uncaught errors in the page').toEqual([]);
  });

  test('1. developer sees the sample trucks', async () => {
    await openSignIn(dev);
    await signIn(dev, DEV.id, DEV.password);
    await expectSampleTrucks(dev);
  });

  test('2. developer creates a fleet and its owner', async () => {
    const dialog = await openFleets(dev);
    await dev.fill('#fleet-name', FLEET_NAME);
    await dev.fill('#fleet-owner-name', 'Asha Acme');
    await dev.fill('#fleet-owner-email', OWNER_EMAIL);
    await dialog.getByRole('button', { name: 'Create fleet' }).click();
    const code = dialog.locator('code').first();
    await expect(code).toBeVisible();
    ownerPassword = (await code.innerText()).trim();
    expect(ownerPassword.length).toBeGreaterThan(0);
    await dialog.getByRole('button', { name: /saved it/ }).click();
    await expect(dialog.locator('li', { hasText: FLEET_NAME })).toBeVisible();
    await dialog.locator('[aria-label=Close]').click();
    await expect(dialog).toHaveCount(0);
  });

  test('3. owner never sees sample data', async () => {
    await openSignIn(owner);
    await owner.evaluate(() => {
      sessionStorage.setItem('__hits', '[]');
      sessionStorage.setItem('__on', '1');
    });
    await signIn(owner, OWNER_EMAIL, ownerPassword);
    await expect(owner.getByText('No vehicles yet')).toBeVisible();
    const hits: string[] = await owner.evaluate(() => {
      sessionStorage.setItem('__on', '0');
      return JSON.parse(sessionStorage.getItem('__hits') || '[]');
    });
    expect(hits, 'sample-truck ids seen by the owner').toEqual([]);
    // Hidden text too (for example <option> elements), which the sampler cannot see.
    await expect(owner.locator('body')).not.toContainText('TATA-');
  });

  test('4. owner adds a vehicle and a scan completes', async () => {
    await owner.getByRole('button', { name: /Add vehicle/i }).first().click();
    await owner.locator('input[placeholder="FLEET-108"]').fill(VEHICLE_ID);
    await owner.locator('button[type=submit]', { hasText: 'Commission' }).click();
    await expectShows(owner, VEHICLE_ID);

    const diagnosed = owner.waitForResponse((r) => r.url().includes('/api/diagnose'));
    await owner.locator('#run-diagnostics-btn:visible').first().click();
    expect((await diagnosed).status(), '/api/diagnose status').toBe(200);
    await expect(owner.locator('#run-diagnostics-btn:visible', { hasText: 'Scanning' })).toHaveCount(0);
    await expectShows(owner, /STATUS: (HEALTHY|WARNING|CRITICAL_STOP)/);
  });

  test('5. switching operators leaves nothing behind', async ({ browser }) => {
    const { context, page } = await newPage(browser);
    contexts.push(context);
    await openSignIn(page);
    await signIn(page, DIRECTOR.id, DIRECTOR.password);
    await expectSampleTrucks(page);

    await switchOperator(page, OWNER_EMAIL, ownerPassword, true);
    await expectShows(page, VEHICLE_ID);
    await expect(page.locator('body')).not.toContainText('TATA-');
    await expect(page.locator('[role=dialog]')).toHaveCount(0);

    await switchOperator(page, DIRECTOR.email, DIRECTOR.password, false);
    await expectSampleTrucks(page);
    await expect(page.locator('body')).not.toContainText(VEHICLE_ID);
    await expect(page.locator('[role=dialog]')).toHaveCount(0);
  });

  test('6. a suspended fleet is told why and loses its data', async () => {
    const dialog = await openFleets(dev);
    const row = dialog.locator('li', { hasText: FLEET_NAME });
    await row.getByRole('button', { name: 'Suspend', exact: true }).click();
    await row.getByRole('button', { name: 'Confirm suspend' }).click();
    await expect(row.getByText('Suspended', { exact: true })).toBeVisible();
    await dialog.locator('[aria-label=Close]').click();

    await owner.locator('#run-diagnostics-btn:visible').first().click();
    await expect(owner.getByText(SUSPENDED)).toHaveCount(1);
    await expect(owner.getByText(VEHICLE_ID)).toHaveCount(0);
    await expect(owner.locator('button:visible', { hasText: /^\s*Sign out\s*$/ }).first()).toBeVisible();  });
});
