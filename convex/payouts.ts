import { query } from "./_generated/server";
import { v } from "convex/values";
import { validateToken } from "./util";

/**
 * Fetches the payout history for a specific store.
 * Only the store owner is authorized to call this.
 */
export const getPayoutsByStore = query({
  args: {
    tokenIdentifier: v.string(),
    storeId: v.id("stores"),
  },
  handler: async (ctx, args) => {
    // 1. Authenticate and authorize the user
    const user = await validateToken(ctx, args.tokenIdentifier);
    const store = await ctx.db.get(args.storeId);

    if (!store || store.ownerId !== user.tokenIdentifier) {
      throw new Error("You are not authorized to view payouts for this store.");
    }

    // 2. Fetch payouts for the store, most recent first
    const payouts = await ctx.db
      .query("payouts")
      .withIndex("by_store", (q) => q.eq("storeId", args.storeId))
      .order("desc")
      .collect();

    return payouts.map((p) => ({
      ...p,
      amount: parseFloat(p.amount.toFixed(6)),
    }));
  },
});