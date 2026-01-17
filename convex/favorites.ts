import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
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
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    const favorites = await ctx.db.query("productFavorites").withIndex("by_user", q => q.eq("userId", user._id)).collect();
    
    const products = await Promise.all(
      favorites.map(async (fav) => {
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
    );
    return products.filter(Boolean); // Filter out any nulls if a product was deleted
  },
});