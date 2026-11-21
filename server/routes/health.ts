// Health routes. They return nothing about the system or the user except "ok" and the caller's own role.
// /health          public      proves the gateway is the one answering
// /health-customer customer    proves a login token is checked
// /health-staff    staff       proves the role check (a customer must get 403)
// /health-admin    admin       proves the strictest level (an employee must get 403)
import type { RouteDef } from '../gateway/types.js';

export const healthRoutes: RouteDef[] = [
  { method: 'GET', path: '/health', access: 'public', handle: async () => ({ status: 200, body: { ok: true, service: 'veyns-gateway' } }) },
  { method: 'GET', path: '/health-customer', access: 'customer', handle: async (ctx) => ({ status: 200, body: { ok: true, role: ctx.identity?.role } }) },
  { method: 'GET', path: '/health-staff', access: 'staff', handle: async (ctx) => ({ status: 200, body: { ok: true, role: ctx.identity?.role } }) },
  { method: 'GET', path: '/health-admin', access: 'admin', handle: async (ctx) => ({ status: 200, body: { ok: true, role: ctx.identity?.role } }) },
];
