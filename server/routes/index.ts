// The list of every route the gateway serves. A route that is not listed here does not exist.
// Step 4C moves the three old api/ functions in here, one at a time.
import { getServiceClient } from '../db/client.js';
import type { RouteDef } from '../gateway/types.js';
import { adminCreateCustomerRoute } from './adminCreateCustomer.js';
import { adminLedgerRoutes } from './adminLedger.js';
import { feedbackRoute } from './feedback.js';
import { healthRoutes } from './health.js';
import { claimLoyaltyRewardRoute, claimPlatinumDiscountRoute } from './loyaltyClaims.js';
import { myOrdersRoute } from './myOrders.js';
import { myProfileRoute } from './myProfile.js';
import { orderGeocodeRoute } from './orderGeocode.js';
import { placeOrderRoute } from './placeOrder.js';

export const routes: RouteDef[] = [
  ...healthRoutes,
  adminCreateCustomerRoute(getServiceClient), // 4C-1
  orderGeocodeRoute(getServiceClient),        // 4C-3
  myProfileRoute(getServiceClient),           // 5D
  placeOrderRoute(getServiceClient),          // 5E-2
  myOrdersRoute(getServiceClient),            // 5E-3
  feedbackRoute(getServiceClient),            // 5F-2
  claimLoyaltyRewardRoute(getServiceClient),  // 5G-3
  claimPlatinumDiscountRoute(getServiceClient), // 5G-3
  ...adminLedgerRoutes(getServiceClient),     // 6B-3
];
