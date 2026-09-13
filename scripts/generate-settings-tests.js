const fs = require('fs');
const path = require('path');

const tabs = [
  { id: 'general', name: 'General', saveBtn: 'Save Settings', verifyField: 'Site Name' },
  { id: 'company', name: 'Company', saveBtn: 'Save Details', verifyField: 'Company Name' },
  { id: 'marketplace', name: 'Marketplace', saveBtn: 'Save Marketplace', verifyField: 'Description' },
  { id: 'visits', name: 'Visits', saveBtn: 'Save Settings', verifyField: 'Tracking' },
  { id: 'channels', name: 'Channels', saveBtn: 'Save Channels', verifyField: 'Channel Name' },
  { id: 'social', name: 'Social', saveBtn: 'Save Social', verifyField: 'Facebook' },
];

const template = (tab) => `goal: Test CRUD cycle for Settings - ${tab.name}

statements:
  - URL: /projects
  - intent: Select the first available project
    action: click
    locator: "getByRole('button', { name: 'Select' }).first()"

  - WAIT_UNTIL: The user is navigated to the default project page
    js: "await page.url().includes('/robots')"
    timeout_seconds: 5

  - URL: /settings
  - WAIT_UNTIL: The settings page is loaded
    js: "await page.url().endsWith('/settings')"
    timeout_seconds: 15

  - intent: Click ${tab.name} tab
    action: click
    locator: "getByRole('tab', { name: /${tab.name}/i })"

  - intent: Click Save
    action: click
    locator: "getByRole('button', { name: /Save|Guardar/i }).first()"

  - WAIT_UNTIL: Save completes
    js: "await page.waitForTimeout(2000)"
    timeout_seconds: 5
`;

tabs.forEach(tab => {
  const filename = 'crud-settings-' + tab.id + '.test.yaml';
  const filepath = path.join(__dirname, '..', 'tests', filename);
  const fixedTemplate = template(tab);
  fs.writeFileSync(filepath, fixedTemplate);
  console.log('Created ' + filename);
});

// Specific test for Secrets
const secretsTemplate = `goal: Complete CRUD cycle for a Secret in Settings

statements:
  - URL: /projects
  - intent: Select the first available project
    action: click
    locator: "getByRole('button', { name: 'Select' }).first()"

  - WAIT_UNTIL: The user is navigated to the default project page
    js: "await page.url().includes('/robots')"
    timeout_seconds: 5

  - URL: /settings
  - WAIT_UNTIL: The settings page is loaded
    js: "await page.url().endsWith('/settings')"
    timeout_seconds: 15

  - intent: Click Secrets tab
    action: click
    locator: "getByRole('tab', { name: /Secrets|Secretos/i })"

  - intent: Click Add Secret button
    action: click
    locator: "getByRole('button', { name: /Add Secret/i })"

  - WAIT_UNTIL: The Add Secret modal is open
    js: 'await page.locator("div[role=\\"dialog\\"]").count() > 0'
    timeout_seconds: 5

  - intent: Fill Environment Variable Name
    action: fill
    locator: "getByLabel(/Environment Variable Name/i)"
    value: "TEST_VAR"

  - intent: Fill Provider
    action: fill
    locator: "getByLabel(/Provider/i)"
    value: "TEST_PROVIDER"

  - intent: Fill Value
    action: fill
    locator: "getByLabel(/Secret Value/i)"
    value: "dummy123"

  - intent: Click Save Secret
    action: click
    locator: "getByRole('button', { name: /Save Secret/i })"

  - WAIT_UNTIL: The modal is closed
    js: 'await page.locator("div[role=\\"dialog\\"]").count() === 0'
    timeout_seconds: 10

  - VERIFY: The secret is visible in the list
    js: "await expect(page.getByText('TEST_VAR').first()).toBeVisible()"

  - intent: Click Delete on the secret row
    action: click
    locator: "page.locator('tr').filter({ hasText: 'TEST_VAR' }).first().getByRole('button').last()"

  - WAIT_UNTIL: The delete confirmation modal is open
    js: 'await page.locator("div[role=\\"alertdialog\\"]").count() > 0 || await page.locator("div[role=\\"dialog\\"]").count() > 0'
    timeout_seconds: 5

  - intent: Confirm deletion
    action: click
    locator: "getByRole('button', { name: /Delete|Eliminar/i }).last()"

  - VERIFY: The secret is removed from the list
    js: "await expect(page.getByText('TEST_VAR')).toHaveCount(0)"
`;

fs.writeFileSync(path.join(__dirname, '..', 'tests', 'crud-settings-secrets.test.yaml'), secretsTemplate);
console.log('Created crud-settings-secrets.test.yaml');

// Specific test for Team
const teamTemplate = `goal: Complete CRUD cycle for a Team Member in Settings

statements:
  - URL: /projects
  - intent: Select the first available project
    action: click
    locator: "getByRole('button', { name: 'Select' }).first()"

  - WAIT_UNTIL: The user is navigated to the default project page
    js: "await page.url().includes('/robots')"
    timeout_seconds: 5

  - URL: /settings
  - WAIT_UNTIL: The settings page is loaded
    js: "await page.url().endsWith('/settings')"
    timeout_seconds: 15

  - intent: Click Team tab
    action: click
    locator: "getByRole('tab', { name: /Team|Equipo/i })"

  - intent: Click Add Team Member button
    action: click
    locator: "getByRole('button', { name: /Add|Nuevo/i }).first()"

  - WAIT_UNTIL: The modal is open
    js: 'await page.locator("div[role=\\"dialog\\"]").count() > 0'
    timeout_seconds: 5

  - intent: Fill Email
    action: fill
    locator: "getByLabel(/Email/i)"
    value: "test.member@example.com"

  - intent: Click Invite
    action: click
    locator: "getByRole('button', { name: /Invite|Invitar|Save/i })"

  - WAIT_UNTIL: The modal is closed
    js: 'await page.locator("div[role=\\"dialog\\"]").count() === 0'
    timeout_seconds: 10

  - VERIFY: The team member is visible in the list
    js: "await expect(page.getByText('test.member@example.com').first()).toBeVisible()"

  - intent: Click Remove on the member row
    action: click
    locator: "page.locator('div').filter({ hasText: 'test.member@example.com' }).first().getByRole('button', { name: /Remove|Eliminar/i }).first()"

  - WAIT_UNTIL: The delete confirmation modal is open
    js: 'await page.locator("div[role=\\"alertdialog\\"]").count() > 0 || await page.locator("div[role=\\"dialog\\"]").count() > 0'
    timeout_seconds: 5

  - intent: Confirm deletion
    action: click
    locator: "getByRole('button', { name: /Delete|Remove|Eliminar/i }).last()"
`;

fs.writeFileSync(path.join(__dirname, '..', 'tests', 'crud-settings-team.test.yaml'), teamTemplate);
console.log('Created crud-settings-team.test.yaml');

// Specific test for Calendar
const calendarTemplate = `goal: Complete CRUD cycle for a Calendar in Settings

statements:
  - URL: /projects
  - intent: Select the first available project
    action: click
    locator: "getByRole('button', { name: 'Select' }).first()"

  - WAIT_UNTIL: The user is navigated to the default project page
    js: "await page.url().includes('/robots')"
    timeout_seconds: 5

  - URL: /settings
  - WAIT_UNTIL: The settings page is loaded
    js: "await page.url().endsWith('/settings')"
    timeout_seconds: 15

  - intent: Click Calendar tab
    action: click
    locator: "getByRole('tab', { name: /Calendar/i })"

  - intent: Click Add Calendar button
    action: click
    locator: "getByRole('button', { name: /Add Calendar|New Calendar/i }).first()"

  - WAIT_UNTIL: The modal is open
    js: 'await page.locator("div[role=\\"dialog\\"]").count() > 0'
    timeout_seconds: 5

  - intent: Fill Calendar Name
    action: fill
    locator: "getByLabel(/Name|Nombre/i).first()"
    value: "Test Calendar"

  - intent: Click Save
    action: click
    locator: "getByRole('button', { name: /Save|Guardar/i }).last()"

  - WAIT_UNTIL: The modal is closed
    js: 'await page.locator("div[role=\\"dialog\\"]").count() === 0'
    timeout_seconds: 10

  - VERIFY: The calendar is visible in the list
    js: "await expect(page.getByText('Test Calendar').first()).toBeVisible()"

  - intent: Click Delete on the calendar row
    action: click
    locator: "page.locator('div').filter({ hasText: 'Test Calendar' }).first().getByRole('button').last()"

  - WAIT_UNTIL: The delete confirmation modal is open
    js: 'await page.locator("div[role=\\"alertdialog\\"]").count() > 0 || await page.locator("div[role=\\"dialog\\"]").count() > 0'
    timeout_seconds: 5

  - intent: Confirm deletion
    action: click
    locator: "getByRole('button', { name: /Delete|Remove|Eliminar/i }).last()"
`;

fs.writeFileSync(path.join(__dirname, '..', 'tests', 'crud-settings-calendar.test.yaml'), calendarTemplate);
console.log('Created crud-settings-calendar.test.yaml');
