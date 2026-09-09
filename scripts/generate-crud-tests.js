const fs = require('fs');
const path = require('path');

const entities = [
  { name: 'Agent', path: '/agents', plural: 'Agents', addBtn: 'New agent', titleField: 'Automated Test Agent' },
  { name: 'Asset', path: '/assets', plural: 'Assets', addBtn: 'New asset', titleField: 'Automated Test Asset' },
  { name: 'Modifier Group', path: '/catalog/modifier-groups', plural: 'Modifier Groups', addBtn: 'New modifier group', titleField: 'Automated Test Modifier Group' },
  { name: 'Inventory Item', path: '/inventory', plural: 'Inventory', addBtn: 'New item', titleField: 'Automated Test Inventory Item' },
  { name: 'Order', path: '/orders', plural: 'Orders', addBtn: 'New order', titleField: 'Automated Test Order' },
  { name: 'Person', path: '/people', plural: 'People', addBtn: 'New person', titleField: 'Automated Test Person' },
  { name: 'Reservation', path: '/reservations', plural: 'Reservations', addBtn: 'New reservation', titleField: 'Automated Test Reservation' },
  { name: 'Robot', path: '/robots', plural: 'Robots', addBtn: 'New robot', titleField: 'Automated Test Robot' },
  { name: 'Shipment', path: '/shipments', plural: 'Shipments', addBtn: 'New shipment', titleField: 'Automated Test Shipment' }
];

const template = (entity) => `goal: Complete CRUD cycle for a ${entity.name}

statements:
  - URL: /projects
  - intent: Select the first available project
    action: click
    locator: "getByRole('button', { name: 'Select' }).first()"

  - WAIT_UNTIL: The user is navigated to the default project page
    js: "await page.url().includes('/robots')"
    timeout_seconds: 5

  - URL: ${entity.path}
  - WAIT_UNTIL: The page is loaded
    js: "await page.url().endsWith('${entity.path}')"
    timeout_seconds: 15

  - intent: Click ${entity.addBtn} in the top bar
    action: click
    locator: "getByRole('button', { name: '${entity.addBtn}' })"

  - intent: Fill the ${entity.name.toLowerCase()} name
    action: fill
    locator: "getByRole('textbox').first()"
    value: "${entity.titleField}"

  - intent: Submit the create ${entity.name.toLowerCase()} form
    action: click
    locator: "getByRole('button', { name: 'Create' })"

  - WAIT_UNTIL: The create modal closes
    js: "await page.locator('div[role=\"dialog\"]').count() === 0"
    timeout_seconds: 10

  - WAIT_UNTIL: The ${entity.name.toLowerCase()} details page is open
    js: "await page.url().includes('${entity.path}/') && !page.url().endsWith('${entity.path}')"
    timeout_seconds: 15

  - VERIFY: The created ${entity.name.toLowerCase()} name is visible
    js: "await expect(page.getByText('${entity.titleField}').first()).toBeVisible()"

  - intent: Click Delete on the details toolbar
    action: click
    locator: "getByRole('button', { name: 'Delete' })"

  - intent: Confirm deletion
    action: click
    locator: "getByRole('button', { name: 'Delete' }).last()"

  - WAIT_UNTIL: The user is back on the list
    js: "await page.url().endsWith('${entity.path}')"
    timeout_seconds: 15

  - VERIFY: The ${entity.name.toLowerCase()} is gone from the list
    js: "await expect(page.getByText('${entity.titleField}')).toHaveCount(0)"
`;

entities.forEach(entity => {
  const filename = 'crud-' + entity.name.toLowerCase().replace(/ /g, '-') + '.test.yaml';
  const filepath = path.join(__dirname, '..', 'tests', filename);
  const fixedTemplate = template(entity).replace(/div\[role=\\"dialog\\"\]/g, "div[role='dialog']");
  fs.writeFileSync(filepath, fixedTemplate);
  console.log('Created ' + filename);
});
