// Tests for the Inventory gateway routes (Step 6C-2).
// Run from the project root:  npx tsx --test server/tests/adminInventory.test.ts
// Fake database client and fake identity lookup: no network, no database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGateway } from '../gateway/gateway.js';
import { adminInventoryRoutes } from '../routes/adminInventory.js';
import type { Identity } from '../gateway/types.js';

const TOKENS: Record<string, Identity> = {
  'customer-token': { userId: 'u-customer', role: 'regular' },
  'employee-token': { userId: 'u-employee', role: 'employee' },
  'admin-token': { userId: 'u-admin', role: 'admin' },
};
const resolveIdentity = async (token: string) => TOKENS[token] || null;

const ID = '3f2b8c1e-5a4d-4e7b-9c10-0a1b2c3d4e5f';
const ID2 = '9a8b7c6d-1111-4222-8333-444455556666';
type Reply = { data: any; error: any };

function harness(rpc?: (fn: string, args: any) => Reply) {
  const calls: [string, any][] = [];
  const client = {
    rpc: async (fn: string, args: any) => { calls.push([fn, args]); return rpc ? rpc(fn, args) : { data: 'new-id', error: null }; },
  };
  const gateway = createGateway({ routes: adminInventoryRoutes(() => client), resolveIdentity, log: () => {} });
  return { gateway, calls };
}

function post(g: (req: any, res: any) => Promise<void>, path: string, token: string | null, body: any, method = 'POST') {
  const headers: Record<string, string> = { 'x-forwarded-for': '1.1.1.1' };
  if (token) headers.authorization = 'Bearer ' + token;
  const req = { method, url: '/api/' + path, headers, body };
  const out: { status: number; body: any } = { status: 0, body: undefined };
  const res = { setHeader() {}, status(c: number) { out.status = c; return res; }, json(b: any) { out.body = b; } };
  return g(req, res).then(() => out);
}

const ingredient = { name: '  Pork   Belly ', category: 'Marinade', unit: ' g ', stock: 2000, par: 500, price: 380, packs: 2, amount: 2000 };
const recipe = { dishId: ID, bowls: 20, price: 99, lines: [{ ingredientId: ID2, section: 'Marinade', used: 100, serves: 1 }] };
const BODIES: Record<string, any> = {
  'admin-inventory-save-ingredient': ingredient,
  'admin-inventory-restock': { id: ID, amount: 500 },
  'admin-inventory-waste': { id: ID, amount: 50 },
  'admin-inventory-cook': { dishId: ID, count: 1 },
  'admin-inventory-save-recipe': recipe,
  'admin-inventory-add-dish': { name: 'Pork Sisig' },
};
const PATHS = Object.keys(BODIES);

test('who may call: no token 401, customer 403, GET 405; the database is never called', async () => {
  const h = harness();
  for (const p of PATHS) {
    assert.equal((await post(h.gateway, p, null, BODIES[p])).status, 401);
    assert.equal((await post(h.gateway, p, 'customer-token', BODIES[p])).status, 403);
    assert.equal((await post(h.gateway, p, 'admin-token', undefined, 'GET')).status, 405);
  }
  assert.equal(h.calls.length, 0);
});

test('staff: an employee and an admin may both use every route', async () => {
  for (const token of ['employee-token', 'admin-token']) {
    const h = harness();
    for (const p of PATHS) assert.ok([200, 201].includes((await post(h.gateway, p, token, BODIES[p])).status), p);
    assert.equal(h.calls.length, PATHS.length);
  }
});

test('the user id comes from the token, never from the body', async () => {
  const h = harness();
  for (const p of PATHS) await post(h.gateway, p, 'employee-token', { ...BODIES[p], p_uid: 'u-evil', userId: 'u-evil', uid: 'u-evil' });
  assert.equal(h.calls.length, PATHS.length);
  for (const [, args] of h.calls) assert.equal(args.p_uid, 'u-employee');
});

test('save ingredient: new answers 201, clean values go to the database', async () => {
  const h = harness();
  const r = await post(h.gateway, 'admin-inventory-save-ingredient', 'admin-token', ingredient);
  assert.equal(r.status, 201);
  assert.deepEqual(r.body, { ok: true, id: 'new-id' });
  assert.deepEqual(h.calls[0], ['admin_inventory_save_ingredient_for', {
    p_uid: 'u-admin', p_id: null, p_name: 'Pork Belly', p_category: 'Marinade', p_unit: 'g',
    p_stock: 2000, p_par: 500, p_price: 380, p_packs: 2, p_amount: 2000,
  }]);
});

test('save ingredient: edit (with id) answers 200 and passes the id', async () => {
  const h = harness();
  const r = await post(h.gateway, 'admin-inventory-save-ingredient', 'admin-token', { ...ingredient, id: ID });
  assert.equal(r.status, 200);
  assert.equal(h.calls[0][1].p_id, ID);
});

test('save ingredient: bad input is refused with 400 before the database is called', async () => {
  const h = harness();
  const bad: [any, string][] = [
    [{ ...ingredient, id: 'abc' }, 'invalid_id'],
    [{ ...ingredient, name: '   ' }, 'invalid_name'],
    [{ ...ingredient, name: 'x'.repeat(101) }, 'invalid_name'],
    [{ ...ingredient, category: 'Drinks' }, 'invalid_category'],
    [{ ...ingredient, unit: '' }, 'invalid_unit'],
    [{ ...ingredient, stock: -1 }, 'invalid_stock'],
    [{ ...ingredient, stock: '5' }, 'invalid_stock'],
    [{ ...ingredient, par: -1 }, 'invalid_par'],
    [{ ...ingredient, price: NaN }, 'invalid_price'],
    [{ ...ingredient, price: 2e9 }, 'invalid_price'],
    [{ ...ingredient, packs: 0 }, 'invalid_packs'],
    [{ ...ingredient, amount: 0 }, 'invalid_amount'],
  ];
  for (const [body, code] of bad) {
    const r = await post(h.gateway, 'admin-inventory-save-ingredient', 'admin-token', body);
    assert.equal(r.status, 400, code);
    assert.equal(r.body.code, code);
  }
  assert.equal(h.calls.length, 0);
});

test('restock: paid is optional (null when empty); bad values are refused', async () => {
  const h = harness();
  assert.equal((await post(h.gateway, 'admin-inventory-restock', 'admin-token', { id: ID, amount: 500 })).status, 200);
  assert.deepEqual(h.calls[0], ['admin_inventory_restock_for', { p_uid: 'u-admin', p_id: ID, p_amount: 500, p_paid: null }]);
  await post(h.gateway, 'admin-inventory-restock', 'admin-token', { id: ID, amount: 500, paid: 250.5 });
  assert.equal(h.calls[1][1].p_paid, 250.5);
  const n = h.calls.length;
  for (const body of [{ id: 'x', amount: 5 }, { id: ID, amount: 0 }, { id: ID, amount: -3 }, { id: ID, amount: '5' }, { id: ID, amount: 5, paid: -1 }]) {
    assert.equal((await post(h.gateway, 'admin-inventory-restock', 'admin-token', body)).status, 400);
  }
  assert.equal(h.calls.length, n);
});

test('waste: success calls the waste function; amount must be above 0', async () => {
  const h = harness();
  assert.equal((await post(h.gateway, 'admin-inventory-waste', 'admin-token', { id: ID, amount: 50 })).status, 200);
  assert.deepEqual(h.calls[0], ['admin_inventory_waste_for', { p_uid: 'u-admin', p_id: ID, p_amount: 50 }]);
  for (const body of [{ id: ID, amount: 0 }, { id: 'x', amount: 1 }, { id: ID }]) {
    assert.equal((await post(h.gateway, 'admin-inventory-waste', 'admin-token', body)).status, 400);
  }
  assert.equal(h.calls.length, 1);
});

test('cook: whole number of bowls from 1 to 1000', async () => {
  const h = harness();
  assert.equal((await post(h.gateway, 'admin-inventory-cook', 'admin-token', { dishId: ID, count: 20 })).status, 200);
  assert.deepEqual(h.calls[0], ['admin_inventory_cook_for', { p_uid: 'u-admin', p_dish_id: ID, p_count: 20 }]);
  for (const body of [{ dishId: ID, count: 0 }, { dishId: ID, count: 1.5 }, { dishId: ID, count: 1001 }, { dishId: ID, count: '2' }, { dishId: 'x', count: 1 }]) {
    assert.equal((await post(h.gateway, 'admin-inventory-cook', 'admin-token', body)).status, 400);
  }
  assert.equal(h.calls.length, 1);
});

test('save recipe: lines are sent in database shape; empty list is allowed', async () => {
  const h = harness();
  assert.equal((await post(h.gateway, 'admin-inventory-save-recipe', 'admin-token', recipe)).status, 200);
  assert.deepEqual(h.calls[0], ['admin_inventory_save_recipe_for', {
    p_uid: 'u-admin', p_dish_id: ID, p_bowls: 20, p_price: 99,
    p_lines: [{ ingredient_id: ID2, section: 'Marinade', used: 100, serves: 1 }],
  }]);
  assert.equal((await post(h.gateway, 'admin-inventory-save-recipe', 'admin-token', { ...recipe, lines: [] })).status, 200);
});

test('save recipe: bad input is refused with 400 before the database is called', async () => {
  const h = harness();
  const line = recipe.lines[0];
  const bad: any[] = [
    { ...recipe, dishId: 'x' },
    { ...recipe, bowls: 0 },
    { ...recipe, price: -1 },
    { ...recipe, lines: 'nope' },
    { ...recipe, lines: Array.from({ length: 101 }, (_, i) => ({ ...line, section: 'Sauce', ingredientId: ID2.slice(0, -3) + String(100 + i) })) },
    { ...recipe, lines: [{ ...line, ingredientId: 'x' }] },
    { ...recipe, lines: [{ ...line, section: 'Drinks' }] },
    { ...recipe, lines: [{ ...line, used: 0 }] },
    { ...recipe, lines: [{ ...line, serves: 0 }] },
    { ...recipe, lines: [null] },
    { ...recipe, lines: [line, line] },
  ];
  for (const body of bad) assert.equal((await post(h.gateway, 'admin-inventory-save-recipe', 'admin-token', body)).status, 400);
  assert.equal(h.calls.length, 0);
});

test('add dish: success 201 with id; empty or long names refused', async () => {
  const h = harness();
  const r = await post(h.gateway, 'admin-inventory-add-dish', 'admin-token', { name: '  Pork   Sisig ' });
  assert.equal(r.status, 201);
  assert.deepEqual(r.body, { ok: true, id: 'new-id' });
  assert.deepEqual(h.calls[0], ['admin_inventory_add_dish_for', { p_uid: 'u-admin', p_name: 'Pork Sisig' }]);
  for (const name of ['', '   ', 'x'.repeat(101), 5]) assert.equal((await post(h.gateway, 'admin-inventory-add-dish', 'admin-token', { name })).status, 400);
  assert.equal(h.calls.length, 1);
});

test('database answers: own rule messages kept, not found 404, forbidden 403, signed out 401, raw or unexpected hidden', async () => {
  const run = async (error: any) => {
    const h = harness(() => ({ data: null, error }));
    return post(h.gateway, 'admin-inventory-cook', 'admin-token', BODIES['admin-inventory-cook']);
  };
  const rule = await run({ code: '22023', message: 'Not enough Pork Belly in stock.' });
  assert.equal(rule.status, 400);
  assert.equal(rule.body.code, 'inventory_rejected');
  assert.ok(JSON.stringify(rule.body).includes('Pork Belly'));
  const dup = await run({ code: '23505', message: 'An ingredient with this name already exists.' });
  assert.equal(dup.status, 400);
  assert.ok(JSON.stringify(dup.body).includes('already exists'));
  const raw = await run({ code: '23505', message: 'duplicate key value violates unique constraint "inventory_items_pkey"' });
  assert.equal(raw.status, 400);
  assert.ok(!JSON.stringify(raw.body).includes('inventory_items_pkey'));
  assert.equal((await run({ code: 'P0002', message: 'This recipe no longer exists.' })).status, 404);
  assert.equal((await run({ code: '23514', message: 'check constraint "x"' })).status, 400);
  assert.equal((await run({ code: '42501', message: 'Unauthorized' })).status, 403);
  assert.equal((await run({ code: '28000', message: 'not signed in' })).status, 401);
  const generic = await run({ code: 'XX000', message: 'connection to server at 10.0.0.1 failed' });
  assert.equal(generic.status, 500);
  assert.equal(generic.body.code, 'inventory_failed');
  assert.ok(!JSON.stringify(generic.body).includes('10.0.0.1'));
});

test('rate limit: the 61st call in a minute is 429', async () => {
  const h = harness();
  let last = 0;
  for (let i = 0; i < 61; i++) last = (await post(h.gateway, 'admin-inventory-waste', 'admin-token', { id: 'bad' })).status;
  assert.equal(last, 429);
});
