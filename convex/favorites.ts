import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { validateToken } from "./util";
import { Id } from "./_generated/dataModel";

// Query to check if a product is a favorite for the current user
export const isProductFavorite = query({
  args: {
    tokenIdentifier: v.optional(v.string()),
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    if (!args.tokenIdentifier) return false;
    const user = await validateToken(ctx, args.tokenIdentifier).catch(() => null);
    if (!user) return false;

    const favoriteProduct = await ctx.db
      .query("productFavorites")
      .withIndex("by_user_product", (q) => q.eq("userId", user._id).eq("productId", args.productId))
      .first();
      
    return !!favoriteProduct;
  },
});

// Mutation to add or remove a store from favorites
export const toggleFavorite = mutation({
  args: {
    tokenIdentifier: v.string(),
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);

    const existingFavorite = await ctx.db
      .query("productFavorites")
      .withIndex("by_user_product", (q) => q.eq("userId", user._id).eq("productId", args.productId))
      .first();

    if (existingFavorite) {
      await ctx.db.delete(existingFavorite._id);
      return { isFavorited: false };
    } else {
      // Security: Limit max favorites per user to prevent abuse
      const currentFavoritesCount = (await ctx.db
        .query("productFavorites")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .take(25)).length;

      if (currentFavoritesCount >= 100) {
        throw new ConvexError("You have reached the maximum limit of 100 favorite products.");
      }

      await ctx.db.insert("productFavorites", {
        userId: user._id,
        productId: args.productId,
      });
      return { isFavorited: true };
    }
  },
});

// Query to get all favorite products for a user
export const getFavoriteProducts = query({
  args: { 
    tokenIdentifier: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    const result = await ctx.db.query("productFavorites").withIndex("by_user", q => q.eq("userId", user._id)).order("desc").paginate(args.paginationOpts);
    
    return {
      ...result,
      page: (await Promise.all(
        result.page.map(async (fav) => {
        const product = await ctx.db.get(fav.productId);
        if (!product) return null;        
        const store = await ctx.db.get(product.storeId);
        const imageUrls = product.imageIds ? await Promise.all(product.imageIds.map(id => ctx.storage.getUrl(id))) : [];

        return {
          ...product,
          storeName: store?.name ?? "Unknown Store",
          storeId: store?._id,
          imageUrls: imageUrls.filter((url): url is string => url !== null),
        };
        })
      )).filter((p): p is NonNullable<typeof p> => p !== null)
    };
  },
});