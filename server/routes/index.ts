// The list of every route the gateway serves. A route that is not listed here does not exist.
// Step 4C adds the three existing functions here, one at a time.
import type { RouteDef } from '../gateway/types.js';
import { healthRoutes } from './health.js';

export const routes: RouteDef[] = [...healthRoutes];
