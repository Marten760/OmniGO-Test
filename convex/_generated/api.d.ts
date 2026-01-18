/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as addresses from "../addresses.js";
import type * as analytics from "../analytics.js";
import type * as auth from "../auth.js";
import type * as cart from "../cart.js";
import type * as chat from "../chat.js";
import type * as delivery from "../delivery.js";
import type * as drivers from "../drivers.js";
import type * as favorites from "../favorites.js";
import type * as follows from "../follows.js";
import type * as http from "../http.js";
import type * as inventory from "../inventory.js";
import type * as marketing from "../marketing.js";
import type * as notifications from "../notifications.js";
import type * as orders from "../orders.js";
import type * as paymentsActions from "../paymentsActions.js";
import type * as paymentsQueries from "../paymentsQueries.js";
import type * as payouts from "../payouts.js";
import type * as presence from "../presence.js";
import type * as productCategories from "../productCategories.js";
import type * as products from "../products.js";
import type * as promotions from "../promotions.js";
import type * as reports from "../reports.js";
import type * as reviews from "../reviews.js";
import type * as sampleData from "../sampleData.js";
import type * as search from "../search.js";
import type * as seedData from "../seedData.js";
import type * as storeFavorites from "../storeFavorites.js";
import type * as stores from "../stores.js";
import type * as support from "../support.js";
import type * as users from "../users.js";
import type * as util from "../util.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  addresses: typeof addresses;
  analytics: typeof analytics;
  auth: typeof auth;
  cart: typeof cart;
  chat: typeof chat;
  delivery: typeof delivery;
  drivers: typeof drivers;
  favorites: typeof favorites;
  follows: typeof follows;
  http: typeof http;
  inventory: typeof inventory;
  marketing: typeof marketing;
  notifications: typeof notifications;
  orders: typeof orders;
  paymentsActions: typeof paymentsActions;
  paymentsQueries: typeof paymentsQueries;
  payouts: typeof payouts;
  presence: typeof presence;
  productCategories: typeof productCategories;
  products: typeof products;
  promotions: typeof promotions;
  reports: typeof reports;
  reviews: typeof reviews;
  sampleData: typeof sampleData;
  search: typeof search;
  seedData: typeof seedData;
  storeFavorites: typeof storeFavorites;
  stores: typeof stores;
  support: typeof support;
  users: typeof users;
  util: typeof util;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
