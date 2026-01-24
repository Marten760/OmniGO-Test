import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { validateToken } from "./util";

/**
 * Updates the user's last seen timestamp.
 * This should be called periodically by the client.
 */
export const update = mutation({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);

    const existingPresence = await ctx.db
      .query("presence")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    if (existingPresence) {
      // Optimization: Only update if more than 30 seconds have passed to save DB writes
      if (Date.now() - existingPresence.lastSeen > 30000) {
        await ctx.db.patch(existingPresence._id, { lastSeen: Date.now() });
      }
    } else {
      await ctx.db.insert("presence", {
        userId: user._id,
        lastSeen: Date.now(),
      });
    }
  },
});

/**
 * Gets the presence status for a specific user.
 */
export const get = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("presence")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
  },
});