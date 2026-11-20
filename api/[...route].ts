// Vercel serverless function: the VEYNS API gateway entry point.
// Vercel sends every /api/* request that has no file of its own in api/ to this file.
// Keep it tiny: all logic lives in server/. (Imports end in .js on purpose: the project is "type": "module".)
import { createGateway } from '../server/gateway/gateway.js';
import { resolveIdentity } from '../server/gateway/auth.js';
import { routes } from '../server/routes/index.js';

const gateway = createGateway({ routes, resolveIdentity });

export default function handler(req: any, res: any) {
  return gateway(req, res);
}
