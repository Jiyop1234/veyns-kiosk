// Gateway routes: Inventory writes (Step 6C-2). Staff (employee or admin).
// The gateway already did: token check, STAFF role check, rate limit, body size and JSON check, timeout, safe errors.
// These routes only check the shape of the input and call the service-only database functions from 6C-1
// (admin_inventory_*_for). The user id comes from the verified token, NEVER from the request body.
// The database stays the source of truth for the rules (duplicate names, stock limits, recipe rules).
//
// POST /api/admin-inventory-save-ingredient  body: id? (null = new), name, category, unit, stock, par, price, packs, amount -> 201 new / 200 edit { ok, id }
// POST /api/admin-inventory-restock          body: id, amount, paid?                                                       -> 200 { ok }
// POST /api/admin-inventory-waste            body: id, amount                                                              -> 200 { ok }
// POST /api/admin-inventory-cook             body: dishId, count                                                           -> 200 { ok }
// POST /api/admin-inventory-save-recipe      body: dishId, bowls, price, lines[{ingredientId, section, used, serves}]      -> 200 { ok }
// POST /api/admin-inventory-add-dish         body: name                                                                    -> 201 { ok, id }
import { HttpError } from '../gateway/errors.js';
import type { RouteContext, RouteDef, RouteResult } from '../gateway/types.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SECTIONS = ['Marinade', 'Garnish', 'Sauce', 'Packaging', 'Utilities'];
const MAX_NUM = 1_000_000_000;
const MAX_LINES = 100;
const MAX_COOK = 1000;

export function adminInventoryRoutes(getClient: () => any): RouteDef[] {
  const common = {
    method: 'POST' as const,
    access: 'staff' as const, // Inventory writes are staff level (Step 3 decision)
    timeoutMs: 9000,
    maxBodyBytes: 30000,
    rateLimit: { max: 60, windowSeconds: 60 },
  };
  return [
    { ...common, path: '/admin-inventory-save-ingredient', handle: (ctx) => saveIngredient(ctx, getClient()) },
    { ...common, path: '/admin-inventory-restock', handle: (ctx) => restock(ctx, getClient()) },
    { ...common, path: '/admin-inventory-waste', handle: (ctx) => waste(ctx, getClient()) },
    { ...common, path: '/admin-inventory-cook', handle: (ctx) => cook(ctx, getClient()) },
    { ...common, path: '/admin-inventory-save-recipe', handle: (ctx) => saveRecipe(ctx, getClient()) },
    { ...common, path: '/admin-inventory-add-dish', handle: (ctx) => addDish(ctx, getClient()) },
  ];
}

function bad(message: string, code: string): never {
  throw new HttpError(400, message, code);
}

function readUuid(value: unknown, message: string, code: string): string {
  const id = typeof value === 'string' ? value.trim() : '';
  if (!UUID_RE.test(id)) bad(message, code);
  return id;
}

// A real number from 0 up to MAX_NUM. "positive" means greater than 0.
function readNum(value: unknown, message: string, code: string, positive = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > MAX_NUM || (positive && value <= 0)) bad(message, code);
  return value as number;
}

function readText(value: unknown, max: number, message: string, code: string): string {
  const text = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (!text || text.length > max) bad(message, code);
  return text;
}

// Turns a database refusal into a safe answer. The inventory functions raise their own readable messages for rule
// problems (those are passed on, shortened); raw database wording and anything unexpected is not shown to the user.
function fail(error: any): never {
  const code = String(error?.code || '');
  const msg = String(error?.message || '');
  if (code === '28000') throw new HttpError(401, 'Please sign in again.', 'not_signed_in');
  if (code === '42501' || /unauthori[sz]ed|permission denied/i.test(msg)) {
    console.error('admin-inventory: refused by the database:', code, msg);
    throw new HttpError(403, 'Only staff can change the inventory.', 'forbidden');
  }
  if (code === 'P0002') throw new HttpError(404, msg.slice(0, 200) || 'This item no longer exists.', 'inventory_not_found');
  if (['22023', '23505'].includes(code) && !/^duplicate key|violates/i.test(msg)) {
    throw new HttpError(400, msg.slice(0, 200) || 'The change was not accepted.', 'inventory_rejected');
  }
  if (['P0001', '22023', '22P02', '22003', '23514', '23502', '23503', '23505'].includes(code)) {
    console.error('admin-inventory: rejected:', code, msg);
    throw new HttpError(400, 'The values were not accepted. Please check them and try again.', 'inventory_rejected');
  }
  console.error('admin-inventory: database error:', code, msg);
  throw new HttpError(500, 'The inventory could not be updated. Nothing was saved. Please try again.', 'inventory_failed');
}

async function saveIngredient(ctx: RouteContext, db: any): Promise<RouteResult> {
  const b = ctx.body;
  const isNew = b.id === undefined || b.id === null;
  const id = isNew ? null : readUuid(b.id, 'Choose a valid ingredient.', 'invalid_id');
  const category = typeof b.category === 'string' ? b.category.trim() : '';
  if (!SECTIONS.includes(category)) bad('Choose a category.', 'invalid_category');
  const args = {
    p_uid: ctx.identity!.userId,
    p_id: id,
    p_name: readText(b.name, 100, 'Type the ingredient name (up to 100 characters).', 'invalid_name'),
    p_category: category,
    p_unit: readText(b.unit, 20, 'Type the unit (up to 20 characters).', 'invalid_unit'),
    p_stock: readNum(b.stock, 'Stock must be 0 or more.', 'invalid_stock'),
    p_par: readNum(b.par, 'The par level must be 0 or more.', 'invalid_par'),
    p_price: readNum(b.price, 'The price must be 0 or more.', 'invalid_price'),
    p_packs: readNum(b.packs, 'Packs bought must be more than 0.', 'invalid_packs', true),
    p_amount: readNum(b.amount, 'The amount bought must be more than 0.', 'invalid_amount', true),
  };
  const { data, error } = await db.rpc('admin_inventory_save_ingredient_for', args);
  if (error) fail(error);
  return { status: isNew ? 201 : 200, body: { ok: true, id: data } };
}

async function restock(ctx: RouteContext, db: any): Promise<RouteResult> {
  const b = ctx.body;
  const args = {
    p_uid: ctx.identity!.userId,
    p_id: readUuid(b.id, 'Choose a valid ingredient.', 'invalid_id'),
    p_amount: readNum(b.amount, 'Type an amount greater than 0.', 'invalid_amount', true),
    p_paid: b.paid === undefined || b.paid === null ? null : readNum(b.paid, 'The amount paid must be 0 or more, or left empty.', 'invalid_paid'),
  };
  const { error } = await db.rpc('admin_inventory_restock_for', args);
  if (error) fail(error);
  return { status: 200, body: { ok: true } };
}

async function waste(ctx: RouteContext, db: any): Promise<RouteResult> {
  const b = ctx.body;
  const args = {
    p_uid: ctx.identity!.userId,
    p_id: readUuid(b.id, 'Choose a valid ingredient.', 'invalid_id'),
    p_amount: readNum(b.amount, 'Type an amount greater than 0.', 'invalid_amount', true),
  };
  const { error } = await db.rpc('admin_inventory_waste_for', args);
  if (error) fail(error);
  return { status: 200, body: { ok: true } };
}

async function cook(ctx: RouteContext, db: any): Promise<RouteResult> {
  const b = ctx.body;
  const count = b.count;
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > MAX_COOK) bad('Cook between 1 and 1000 bowls.', 'invalid_count');
  const args = { p_uid: ctx.identity!.userId, p_dish_id: readUuid(b.dishId, 'Choose a valid recipe.', 'invalid_dish'), p_count: count };
  const { error } = await db.rpc('admin_inventory_cook_for', args);
  if (error) fail(error);
  return { status: 200, body: { ok: true } };
}

async function saveRecipe(ctx: RouteContext, db: any): Promise<RouteResult> {
  const b = ctx.body;
  const dishId = readUuid(b.dishId, 'Choose a valid recipe.', 'invalid_dish');
  const bowls = readNum(b.bowls, 'Bowls yielded must be more than 0.', 'invalid_bowls', true);
  const price = readNum(b.price, 'The selling price must be 0 or more.', 'invalid_price');
  if (!Array.isArray(b.lines) || b.lines.length > MAX_LINES) bad('The recipe lines are not valid (up to 100 lines).', 'invalid_lines');
  const seen = new Set<string>();
  const lines = (b.lines as unknown[]).map((raw) => {
    const l = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const ingredient_id = readUuid(l.ingredientId, 'A recipe line has an invalid ingredient.', 'invalid_lines');
    const section = typeof l.section === 'string' ? l.section.trim() : '';
    if (!SECTIONS.includes(section)) bad('A recipe line has an invalid section.', 'invalid_lines');
    const key = section + ':' + ingredient_id.toLowerCase();
    if (seen.has(key)) bad('An ingredient appears twice in the same section.', 'invalid_lines');
    seen.add(key);
    return {
      ingredient_id,
      section,
      used: readNum(l.used, 'Each recipe line needs an amount used above 0.', 'invalid_lines', true),
      serves: readNum(l.serves, 'Each recipe line needs "for (bowls)" above 0.', 'invalid_lines', true),
    };
  });
  const { error } = await db.rpc('admin_inventory_save_recipe_for', { p_uid: ctx.identity!.userId, p_dish_id: dishId, p_bowls: bowls, p_price: price, p_lines: lines });
  if (error) fail(error);
  return { status: 200, body: { ok: true } };
}

async function addDish(ctx: RouteContext, db: any): Promise<RouteResult> {
  const name = readText(ctx.body.name, 100, 'Type the recipe name (up to 100 characters).', 'invalid_name');
  const { data, error } = await db.rpc('admin_inventory_add_dish_for', { p_uid: ctx.identity!.userId, p_name: name });
  if (error) fail(error);
  return { status: 201, body: { ok: true, id: data } };
}
