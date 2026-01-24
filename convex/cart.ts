import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { validateToken } from "./util";
import { ConvexError } from "convex/values";

export const getCartItems = query({
  args: { tokenIdentifier: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.tokenIdentifier) return [];
    const user = await validateToken(ctx, args.tokenIdentifier).catch(() => null);
    if (!user) return [];

    const cartItems = await ctx.db
      .query("cartItems")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    if (cartItems.length === 0) return [];

    // Efficiently fetch all product details in one go to avoid N+1 queries.
    const productIds = [...new Set(cartItems.map(item => item.productId))]; // Deduplicate IDs
    // Select specific fields to ensure `imageId` is included and for efficiency.
    const products = await ctx.db
      .query("products")
      .filter(q => q.or(...productIds.map(id => q.eq(q.field("_id"), id))))
      .collect();
    const productsById = new Map(products.map(p => [p._id, p]));

    // Enrich cart items with product details
    return Promise.all(
      cartItems.map(async (item) => {
        const product = productsById.get(item.productId);

        // Calculate the price including options
        let finalPrice = product?.price ?? 0;
        if (product?.options && item.options) {
          for (const option of product.options) {
            const selectedChoice = item.options[option.title];
            if (selectedChoice) {
              if (Array.isArray(selectedChoice)) { // Multiple choice
                selectedChoice.forEach(choiceName => {
                  const choice = option.choices.find(c => c.name === choiceName);
                  finalPrice += choice?.price_increment ?? 0;
                });
              } else { // Single choice
                const choice = option.choices.find(c => c.name === selectedChoice);
                finalPrice += choice?.price_increment ?? 0;
              }
            }
          }
        }

        return {
          ...item,
          name: product?.name ?? "Unknown Item",
          price: finalPrice, // Use the final calculated price
          // FIX: Use the first image from the `imageIds` array.
          // The form saves an array of image IDs, not a single one.
          imageUrls: product?.imageIds?.[0] ? await ctx.storage.getUrl(product.imageIds[0]) : undefined,
        };
      })
    );
  },
});

export const addItemToCart = mutation({
  args: {
    tokenIdentifier: v.string(),
    productId: v.id("products"),
    storeId: v.id("stores"),
    quantity: v.number(),
    options: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);

    // Check if cart has items from a different store
    const currentCart = await ctx.db.query("cartItems").withIndex("by_user", (q) => q.eq("userId", user._id)).collect();
    const firstItem = currentCart[0];
    if (firstItem && firstItem.storeId !== args.storeId) {
      // Instead of automatically clearing the cart, throw an error.
      // The frontend can catch this and ask the user for confirmation.
      const store = await ctx.db.get(firstItem.storeId);
      throw new ConvexError(`You have items from "${store?.name ?? 'another store'}". You can only order from one store at a time.`);
    }

    // Upsert logic: Check if an identical item already exists
    const existingItem = await ctx.db
      .query("cartItems")
      .withIndex("by_user_product", (q) => q.eq("userId", user._id).eq("productId", args.productId))
      .filter(q => q.eq(q.field("options"), args.options))
      .first();

    if (existingItem) {
      // Update quantity if item exists
      const newQuantity = existingItem.quantity + args.quantity;
      await ctx.db.patch(existingItem._id, { quantity: newQuantity });
    } else {
      // Security: Limit cart size to prevent abuse (e.g., max 50 unique items)
      if (currentCart.length >= 50) {
        throw new ConvexError("Cart is full (max 50 items). Please remove items to add more.");
      }

      // Insert new item if it doesn't exist
      await ctx.db.insert("cartItems", {
        userId: user._id,
        productId: args.productId,
        storeId: args.storeId,
        quantity: args.quantity,
        options: args.options,
      });
    }
  },
});

export const updateCartItemQuantity = mutation({
  args: { tokenIdentifier: v.string(), cartItemId: v.id("cartItems"), quantity: v.number() },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    const item = await ctx.db.get(args.cartItemId);
    if (!item || item.userId !== user._id) throw new ConvexError("Unauthorized access to cart item.");

    if (args.quantity <= 0) {
      await ctx.db.delete(args.cartItemId);
    } else {
      await ctx.db.patch(args.cartItemId, { quantity: args.quantity });
    }
  },
});

export const removeCartItem = mutation({
  args: { tokenIdentifier: v.string(), cartItemId: v.id("cartItems") },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    const item = await ctx.db.get(args.cartItemId);
    if (!item || item.userId !== user._id) throw new ConvexError("Unauthorized access to cart item.");
    await ctx.db.delete(args.cartItemId);
  },
});

export const clearCart = mutation({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    const itemsToDelete = await ctx.db.query("cartItems").withIndex("by_user", q => q.eq("userId", user._id)).collect();
    await Promise.all(itemsToDelete.map(item => ctx.db.delete(item._id)));
  },
});

/**
 * Validates the inventory for all items in the user's cart.
 * Checks both main product quantity and selected options' quantities.
 */
export const validateCartInventory = mutation({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    const cartItems = await ctx.db
      .query("cartItems")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    if (cartItems.length === 0) {
      return { isValid: true, issues: [] }; // Cart is valid if empty
    }

    const issues = [];

    for (const item of cartItems) {
      const product = await ctx.db.get(item.productId);
      if (!product || !product.isAvailable) {
        issues.push({ cartItemId: item._id, name: product?.name ?? "Item", status: "unavailable" });
        continue;
      }

      // Check main product stock if it's tracked (not for options-based stock)
      if (product.quantity !== undefined && product.quantity !== null && !product.options?.length) {
        if (product.quantity < item.quantity) {
          issues.push({ cartItemId: item._id, name: product.name, status: "insufficient_stock", available: product.quantity });
        }
      }

      // Check stock for selected options
      if (item.options && product.options) {
        for (const [optionTitle, selectedChoice] of Object.entries(item.options)) {
          const productOption = product.options.find(opt => opt.title === optionTitle);
          if (!productOption) continue;

          const productChoice = productOption.choices.find(c => c.name === selectedChoice);
          if (productChoice && productChoice.quantity !== undefined && productChoice.quantity !== null) {
            if (productChoice.quantity < item.quantity) {
              issues.push({
                cartItemId: item._id,
                name: `${product.name} (${productChoice.name})`,
                status: "insufficient_stock",
                available: productChoice.quantity,
              });
            }
          }
        }
      }
    }

    return {
      isValid: issues.length === 0,
      issues: issues,
    };
  },
});