import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { validateToken } from "./util";

// Query to check if a store is favorited by the current user
export const isFavorite = query({
  args: {
    tokenIdentifier: v.optional(v.string()),
    storeId: v.id("stores"),
  },
  handler: async (ctx, args) => {
    if (!args.tokenIdentifier) return false;
    const user = await validateToken(ctx, args.tokenIdentifier).catch(() => null);
    if (!user) return false;

    const favorite = await ctx.db
      .query("storeFavorites")
      .withIndex("by_user_store", (q) => q.eq("userId", user._id).eq("storeId", args.storeId))
      .first();
      
    return !!favorite;
  },
});

// Mutation to add or remove a store from the user's favorite list
export const toggleFavorite = mutation({
  args: {
    tokenIdentifier: v.string(),
    storeId: v.id("stores"),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);

    const existingFavorite = await ctx.db
      .query("storeFavorites")
      .withIndex("by_user_store", (q) => q.eq("userId", user._id).eq("storeId", args.storeId))
      .first();

    if (existingFavorite) {
      await ctx.db.delete(existingFavorite._id);
      return { isFavorited: false };
    } else {
      await ctx.db.insert("storeFavorites", {
        userId: user._id,
        storeId: args.storeId,
      });
      return { isFavorited: true };
    }
  },
});

// Query to get all favorite stores for a user
export const getFavoriteStores = query({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    const favorites = await ctx.db.query("storeFavorites").withIndex("by_user", q => q.eq("userId", user._id)).collect();
    
    const storesWithImages = await Promise.all(
      favorites.map(async (fav) => {
        const store = await ctx.db.get(fav.storeId);
        if (!store) return null;
        return {
          ...store,
          logoImageUrl: store.logoImageId ? await ctx.storage.getUrl(store.logoImageId) : null,
          galleryImageUrl: store.galleryImageIds && store.galleryImageIds.length > 0 ? await ctx.storage.getUrl(store.galleryImageIds[0]) : null,
        };
      })
    );

    return storesWithImages.filter(Boolean); // Filter out any nulls if a store was deleted
  },
});