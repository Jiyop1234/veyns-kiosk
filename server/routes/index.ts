// The list of every route the gateway serves. A route that is not listed here does not exist.
// Step 4C moves the three old api/ functions in here, one at a time.
import { getServiceClient } from '../db/client.js';
import type { RouteDef } from '../gateway/types.js';
import { adminCreateCustomerRoute } from './adminCreateCustomer.js';
import { healthRoutes } from './health.js';
import { myProfileRoute } from './myProfile.js';
import { orderGeocodeRoute } from './orderGeocode.js';
import { placeOrderRoute } from './placeOrder.js';

export const routes: RouteDef[] = [
  ...healthRoutes,
  adminCreateCustomerRoute(getServiceClient), // 4C-1
  orderGeocodeRoute(getServiceClient),        // 4C-3
  myProfileRoute(getServiceClient),           // 5D
  placeOrderRoute(getServiceClient),          // 5E-2
];
