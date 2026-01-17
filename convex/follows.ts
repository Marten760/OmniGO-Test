import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
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
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    const follows = await ctx.db.query("follows").withIndex("by_user", q => q.eq("userId", user._id)).collect();
    
    const stores = await Promise.all(
      follows.map(async (follow) => await ctx.db.get(follow.storeId))
    );

    return stores.filter(Boolean); // Filter out any nulls if a store was deleted
  },
});

export const getFollowers = query({
  args: { storeId: v.id("stores") },
  handler: async (ctx, args): Promise<Doc<"users">[]> => {
    const follows = await ctx.db
      .query("follows")
      .withIndex("by_store", (q) => q.eq("storeId", args.storeId))
      .collect();

    const userIds = follows.map((f) => f.userId);
    if (userIds.length === 0) return [];

    const users = await ctx.db
      .query("users")
      .filter((q) => q.or(...userIds.map((id) => q.eq(q.field("_id"), id))))
      .collect();

    return users;
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