import { query } from "./_generated/server";
import { v } from "convex/values";
import { validateToken } from "./util";

/**
 * Fetches all orders assigned to the currently authenticated driver.
 */
export const getAssignedOrders = query({
  args: {
    tokenIdentifier: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);

    // Verify the user has the 'driver' role
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    if (!userProfile?.roles?.includes("driver")) {
      return { assignedStores: [], orders: [] };
    }

    // Get all stores the driver is associated with
    const driverLinks = await ctx.db
      .query("storeDrivers")
      .withIndex("by_driver", (q) => q.eq("driverId", user._id))
      .filter(q => q.eq(q.field("status"), "active"))
      .collect();

    const storeIds = driverLinks.map(link => link.storeId);

    const assignedStores = await Promise.all(
        storeIds.map(id => ctx.db.get(id))
    );

    // Get all orders assigned to this driver that are 'out_for_delivery'
    // OPTIMIZATION: Use 'by_status' index to avoid full table scan on 'driverId'.
    // Fetching active deliveries is much faster than scanning all history.
    const assignedOrders = await ctx.db
      .query("orders")
      .withIndex("by_status", (q) => q.eq("status", "out_for_delivery"))
      .filter(q => q.eq(q.field("driverId"), user._id))
      .collect();
    
    // Sort in memory (newest first)
    assignedOrders.sort((a, b) => b._creationTime - a._creationTime);

    return {
        assignedStores: assignedStores.filter(Boolean), // Filter out nulls if a store was deleted
        orders: assignedOrders,
    };
  },
});