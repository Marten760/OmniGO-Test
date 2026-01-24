import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { validateToken } from "./util";
import { paginationOptsValidator } from "convex/server";
import { Doc } from "./_generated/dataModel";

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
      // Security: Limit max favorites per user to prevent abuse
      const currentFavoritesCount = (await ctx.db
        .query("storeFavorites")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .take(100)).length;

      if (currentFavoritesCount >= 100) {
        throw new ConvexError("You have reached the maximum limit of 100 favorite stores.");
      }

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
  args: { 
    tokenIdentifier: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    const result = await ctx.db.query("storeFavorites").withIndex("by_user", q => q.eq("userId", user._id)).paginate(args.paginationOpts);
    
    return {
      ...result,
      page: (await Promise.all(
        result.page.map(async (fav) => {
          const store = await ctx.db.get(fav.storeId);
          if (!store) return null;
          return {
            ...store,
            logoImageUrl: store.logoImageId ? await ctx.storage.getUrl(store.logoImageId) : null,
            galleryImageUrl: store.galleryImageIds && store.galleryImageIds.length > 0 ? await ctx.storage.getUrl(store.galleryImageIds[0]) : null,
          };
        })
      )).filter((s): s is NonNullable<typeof s> => s !== null)
    };
  },
});