import { internalQuery, query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";
import { paginationOptsValidator } from "convex/server";
import { validateToken } from "./util";

/**
 * Internal query to retrieve a user by their token identifier.
 * This is used by actions to get user information securely.
 */
export const getUser = internalQuery({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db.query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", args.tokenIdentifier))
      .unique();
    if (!user) throw new ConvexError("User must be authenticated.");
    return user;
  },
});

/**
 * Internal query to retrieve a user's profile by their user ID.
 */
export const getProfile = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
  },
});

/**
 * Query to retrieve a user by their document ID.
 */
export const getUserById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => await ctx.db.get(args.userId),
});

/**
 * Get user by Pi Network UID
 */
export const getUserByPiUid = query({
  args: { piUid: v.string() },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_pi_uid", (q) => q.eq("piUid", args.piUid))
      .unique();

    if (!profile) {
      return null;
    }

    const user = await ctx.db.get(profile.userId);
    if (!user) return null;

    // Return the combined user and profile object
    return { 
      ...user, 
      profile: { ...profile, walletAddress: profile.walletAddress ?? undefined } 
    };
  },
});

/**
 * Get all users (for admin purposes)
 */
export const getAllUsers = query({
  args: { 
    tokenIdentifier: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    // Secure admin check using the 'role' field
    if (user.role !== "admin") {
      throw new ConvexError("Unauthorized: Admin access required.");
    }
    
    // Only allow authenticated users to see basic user list
    return await ctx.db.query("users").order("desc").paginate(args.paginationOpts);
  },
});