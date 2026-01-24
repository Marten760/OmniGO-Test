import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { Doc } from "./_generated/dataModel";
import { validateToken } from "./util";

// Query to check if a store is being followed by the current user
export const isFollowing = query({
  args: {
    tokenIdentifier: v.optional(v.string()),
    storeId: v.id("stores"),
  },
  handler: async (ctx, args) => {
    if (!args.tokenIdentifier) return false;
    const user = await validateToken(ctx, args.tokenIdentifier).catch(() => null);
    if (!user) return false;

    const follow = await ctx.db
      .query("follows")
      .withIndex("by_user_store", (q) => q.eq("userId", user._id).eq("storeId", args.storeId))
      .first();
      
    return !!follow;
  },
});

// Mutation to add or remove a store from the user's follow list
export const toggleFollow = mutation({
  args: {
    tokenIdentifier: v.string(),
    storeId: v.id("stores"),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);

    const existingFollow = await ctx.db
      .query("follows")
      .withIndex("by_user_store", (q) => q.eq("userId", user._id).eq("storeId", args.storeId))
      .first();

    if (existingFollow) {
      await ctx.db.delete(existingFollow._id);
      return { isFollowing: false };
    } else {
      // Security: Limit max follows per user to prevent abuse
      const currentFollowsCount = (await ctx.db
        .query("follows")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .take(100)).length;

      if (currentFollowsCount >= 100) {
        throw new ConvexError("You have reached the maximum limit of 100 followed stores.");
      }

      await ctx.db.insert("follows", {
        userId: user._id,
        storeId: args.storeId,
      });
      return { isFollowing: true };
    }
  },
});

// Query to get all stores a user is following
export const getFollowedStores = query({
  args: { 
    tokenIdentifier: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    const result = await ctx.db.query("follows").withIndex("by_user", q => q.eq("userId", user._id)).paginate(args.paginationOpts);
    
    return {
      ...result,
      page: (await Promise.all(
        result.page.map(async (follow) => await ctx.db.get(follow.storeId))
      )).filter((s): s is Doc<"stores"> => s !== null)
    };
  },
});

export const getFollowers = query({
  args: { 
    storeId: v.id("stores"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("follows")
      .withIndex("by_store", (q) => q.eq("storeId", args.storeId))
      .paginate(args.paginationOpts);

    return {
      ...result,
      page: (await Promise.all(
        result.page.map(async (follow) => await ctx.db.get(follow.userId))
      )).filter((u): u is Doc<"users"> => u !== null)
    };
  },
});

export const countFollowers = query({
  args: { storeId: v.id("stores") },
  handler: async (ctx, args) => {
    const follows = await ctx.db
      .query("follows")
      .withIndex("by_store", (q) => q.eq("storeId", args.storeId))
      .collect();
    
    return follows.length;
  },
});