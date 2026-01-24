import { query, mutation, internalQuery } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { paginationOptsValidator } from "convex/server";
import { validateToken } from "./util";

/**
 * Fetches all products for a store and provides a summary.
 */
export const getInventoryDetails = query({
  args: {
    tokenIdentifier: v.string(),
    storeId: v.id("stores"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    const store = await ctx.db.get(args.storeId);
    if (!store || store.ownerId !== user.tokenIdentifier) {
      throw new ConvexError("You are not authorized to view this inventory.");
    }

    const result = await ctx.db
      .query("products")
      .withIndex("by_store", (q) => q.eq("storeId", args.storeId))
      .order("desc")
      .paginate(args.paginationOpts);

    return {
      ...result,
      page: await Promise.all(result.page.map(async (item) => ({
        ...item,
        // FIX: Use the first image from the `imageIds` array, not the old `imageId` field.
        image: item.imageIds?.[0] ? await ctx.storage.getUrl(item.imageIds[0]) : null,
      })))
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
    if (!product) throw new ConvexError("Product not found.");

    const store = await ctx.db.get(product.storeId);
    if (!store || store.ownerId !== user.tokenIdentifier) {
      throw new ConvexError("You are not authorized to update this inventory.");
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

/**
 * Internal query to check if items are available in stock before payment.
 */
export const checkInventoryAvailability = internalQuery({
  args: {
    items: v.array(v.object({
      productId: v.id("products"),
      quantity: v.number(),
      options: v.optional(v.any()),
    }))
  },
  handler: async (ctx, args) => {
    for (const item of args.items) {
      const product = await ctx.db.get(item.productId);
      if (!product) throw new ConvexError(`Product not found.`);
      
      const store = await ctx.db.get(product.storeId);
      
      // Basic availability check
      if (!product.isAvailable) throw new ConvexError(`${product.name} is currently unavailable.`);

      // For restaurants, we usually don't track strict quantity, just availability.
      // For retail/others, we check quantity.
      if (store && store.storeType !== 'restaurant') {
        // Main quantity check
        if (product.quantity !== undefined && product.quantity !== null && (!product.options || product.options.length === 0)) {
          if (product.quantity < item.quantity) {
             throw new ConvexError(`Insufficient stock for ${product.name}. Available: ${product.quantity}`);
          }
        }

        // Options quantity check
        if (item.options && product.options) {
           for (const [optionTitle, selectedChoice] of Object.entries(item.options)) {
              const productOption = product.options.find(o => o.title === optionTitle);
              if (!productOption) continue;
              
              const choicesToCheck = Array.isArray(selectedChoice) ? selectedChoice : [selectedChoice];
              
              for (const choiceName of choicesToCheck) {
                  // @ts-ignore
                  const choice = productOption.choices.find(c => c.name === choiceName);
                  if (choice && choice.quantity !== undefined && choice.quantity !== null) {
                      if (choice.quantity < item.quantity) {
                          throw new ConvexError(`Insufficient stock for ${product.name} - ${choice.name}. Available: ${choice.quantity}`);
                      }
                  }
              }
           }
        }
      }
    }
    return true;
  }
});