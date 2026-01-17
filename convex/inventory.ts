import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { validateToken } from "./util";

/**
 * Fetches all products for a store and provides a summary.
 */
export const getInventoryDetails = query({
  args: {
    tokenIdentifier: v.string(),
    storeId: v.id("stores"),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    const store = await ctx.db.get(args.storeId);
    if (!store || store.ownerId !== user.tokenIdentifier) {
      throw new Error("You are not authorized to view this inventory.");
    }

    const items = await ctx.db
      .query("products")
      .withIndex("by_store", (q) => q.eq("storeId", args.storeId))
      .order("desc")
      .collect();

    const totalItems = items.length;
    const availableItems = items.filter((item) => item.isAvailable).length;
    const unavailableItems = totalItems - availableItems;

    return {
      items: await Promise.all(items.map(async (item) => ({
        ...item,
        // FIX: Use the first image from the `imageIds` array, not the old `imageId` field.
        image: item.imageIds?.[0] ? await ctx.storage.getUrl(item.imageIds[0]) : null,
      }))),
      summary: {
        totalItems,
        availableItems,
        unavailableItems,
      },
    };
  },
});

/**
 * Updates the availability status of a single product.
 * Includes an authorization check to ensure only the store owner can make changes.
 */
export const updateProductAvailability = mutation({
  args: {
    tokenIdentifier: v.string(),
    productId: v.id("products"),
    isAvailable: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);

    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found.");

    const store = await ctx.db.get(product.storeId);
    if (!store || store.ownerId !== user.tokenIdentifier) {
      throw new Error("You are not authorized to update this inventory.");
    }

    await ctx.db.patch(args.productId, { isAvailable: args.isAvailable });
    return { success: true };
  },
});

/**
 * Sets the quantity of a single product and adjusts its availability.
 * Restricted to non-restaurant store types.
 */
export const setProductQuantity = mutation({
  args: {
    tokenIdentifier: v.string(),
    productId: v.id("products"),
    newQuantity: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);

    const product = await ctx.db.get(args.productId);
    if (!product) throw new ConvexError("Product not found.");

    const store = await ctx.db.get(product.storeId);
    if (!store || store.ownerId !== user.tokenIdentifier) {
      throw new ConvexError("You are not authorized to update this inventory.");
    }

    if (store.storeType === 'restaurant') {
      throw new ConvexError("Quantity management is not available for restaurants.");
    }

    const newQuantity = Math.max(0, args.newQuantity);

    await ctx.db.patch(args.productId, { quantity: newQuantity, isAvailable: newQuantity > 0 });
    return { success: true, newQuantity };
  },
});