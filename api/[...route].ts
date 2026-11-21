// Vercel serverless function: the VEYNS API gateway entry point.
// Vercel sends /api/<name> requests that have no file of their own in api/ to this file.
// Only ONE segment arrives here (verified on the 4B preview), so gateway routes use flat names such as /api/health-staff.
// Keep it tiny: all logic lives in server/. (Imports end in .js on purpose: the project is "type": "module".)
import { createGateway } from '../server/gateway/gateway.js';
import { resolveIdentity } from '../server/gateway/auth.js';
import { routes } from '../server/routes/index.js';

const gateway = createGateway({ routes, resolveIdentity });

export default function handler(req: any, res: any) {
  return gateway(req, res);
}
