import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { Doc } from "./_generated/dataModel";
import { validateToken } from "./util";

export const getProductsByStore = query({
  args: { 
    storeId: v.id("stores"),
    category: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("products")
      .withIndex("by_store", (q) => q.eq("storeId", args.storeId));

    if (args.category) {
      query = query.filter((q) => q.eq(q.field("category"), args.category));
    }

    const result = await query.paginate(args.paginationOpts);
    return {
        ...result,
        page: await Promise.all(result.page.map(async (product) => {
            const imageUrls = product.imageIds ? await Promise.all(product.imageIds.map(id => ctx.storage.getUrl(id))) : [];
            return {
                ...product,
                imageUrls: imageUrls.filter((url): url is string => url !== null),
            };
        }))
    };
  },
});

export const getStoreProductsFlat = query({
  args: { storeId: v.id("stores") },
  handler: async (ctx, args) => {
    const products = await ctx.db
      .query("products")
      .withIndex("by_store", (q) => q.eq("storeId", args.storeId))
      .take(500); // OPTIMIZATION: Limit to 500 to prevent OOM. Use pagination for full lists.

    return Promise.all(
      products.map(async (product) => {
        const imageUrls = product.imageIds ? await Promise.all(product.imageIds.map(id => ctx.storage.getUrl(id))) : [];
        return {
          ...product,
          imageUrls: imageUrls.filter((url): url is string => url !== null),
        };
      })
    );
  },
});

export const addProduct = mutation({
  args: {
    tokenIdentifier: v.string(),
    storeId: v.id("stores"),
    name: v.string(),
    description: v.string(),
    price: v.number(),
    category: v.string(),
    isVegetarian: v.optional(v.boolean()),
    isVegan: v.optional(v.boolean()),
    isGlutenFree: v.optional(v.boolean()),
    spiceLevel: v.optional(v.string()),
    quantity: v.optional(v.number()),
    imageIds: v.array(v.id("_storage")), // Changed from imageId to imageIds
    options: v.optional(v.array(v.object({
      title: v.string(),
      type: v.union(v.literal("single"), v.literal("multiple")),
      choices: v.array(v.object({
        name: v.string(),
        price_increment: v.number(),
        quantity: v.optional(v.number()),
        ingredients: v.optional(v.string()),
      })),
    }))),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);

    const store = await ctx.db.get(args.storeId);
    if (!store || store.ownerId !== user.tokenIdentifier) {
      throw new ConvexError("You do not have permission to add products to this store.");
    }

    if (args.price < 0) throw new ConvexError("Price cannot be negative.");
    if (args.quantity !== undefined && args.quantity < 0) throw new ConvexError("Quantity cannot be negative.");

    const dietaryInfo: string[] = [];
    if (args.isVegetarian) dietaryInfo.push("Vegetarian");
    if (args.isVegan) dietaryInfo.push("Vegan");
    if (args.isGlutenFree) dietaryInfo.push("Gluten-Free");

    const { isVegetarian, isVegan, isGlutenFree, ...restArgs } = args;

    const productId = await ctx.db.insert("products", {
      storeId: args.storeId,
      name: args.name,
      description: args.description,
      price: args.price,
      category: args.category,
      imageIds: args.imageIds,
      quantity: args.quantity,
      spiceLevel: args.spiceLevel,
      dietaryInfo,
      options: args.options,
      isAvailable: args.quantity !== undefined ? args.quantity > 0 : true, // Default value
      isPopular: false, // Default value
      ingredients: [], // Default value
    });

    // OPTIMIZATION: Increment the store's totalProducts counter
    await ctx.db.patch(args.storeId, {
      totalProducts: (store.totalProducts ?? 0) + 1,
    });

    return productId;
  },
});

export const updateProduct = mutation({
  args: {
    tokenIdentifier: v.string(),
    productId: v.id("products"),
    name: v.string(),
    description: v.string(),
    price: v.number(),
    category: v.string(),
    isVegetarian: v.optional(v.boolean()),
    isVegan: v.optional(v.boolean()),
    isGlutenFree: v.optional(v.boolean()),
    spiceLevel: v.optional(v.string()),
    quantity: v.optional(v.number()),
    imageIds: v.optional(v.array(v.id("_storage"))), // Changed from imageId to imageIds
    options: v.optional(v.array(v.object({
      title: v.string(),
      type: v.union(v.literal("single"), v.literal("multiple")),
      choices: v.array(v.object({
        name: v.string(),
        price_increment: v.number(),
        quantity: v.optional(v.number()),
        ingredients: v.optional(v.string()),
      })),
    }))),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);

    const { productId, tokenIdentifier, isVegetarian, isVegan, isGlutenFree, ...rest } = args;
    const product = await ctx.db.get(productId);
    if (!product) {
      throw new ConvexError("Product not found.");
    }

    const store = await ctx.db.get(product.storeId);
    if (!store || store.ownerId !== user.tokenIdentifier) {
      throw new ConvexError("You do not have permission to update products for this store.");
    }

    if (args.price < 0) throw new ConvexError("Price cannot be negative.");
    if (args.quantity !== undefined && args.quantity < 0) throw new ConvexError("Quantity cannot be negative.");

    const dietaryInfo: string[] = [];
    if (isVegetarian) dietaryInfo.push("Vegetarian");
    if (isVegan) dietaryInfo.push("Vegan");
    if (isGlutenFree) dietaryInfo.push("Gluten-Free");

    const updateData: Partial<Doc<"products">> = { ...rest, dietaryInfo };

    if (args.quantity !== undefined) {
      updateData.isAvailable = args.quantity > 0;
    }

    await ctx.db.patch(productId, updateData);
  },
});

export const updateOptionQuantities = mutation({
  args: {
    tokenIdentifier: v.string(),
    productId: v.id("products"),
    updates: v.array(v.object({
      optionTitle: v.string(),
      choiceName: v.string(),
      quantity: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    const product = await ctx.db.get(args.productId);

    if (!product) throw new ConvexError("Product not found.");

    const store = await ctx.db.get(product.storeId);
    if (!store || store.ownerId !== user.tokenIdentifier) {
      throw new ConvexError("You are not authorized to update this product.");
    }

    if (!product.options) throw new ConvexError("This product does not have options to update.");

    const newOptions = [...product.options];
    for (const update of args.updates) {
      const optionIndex = newOptions.findIndex(o => o.title === update.optionTitle);
      if (optionIndex !== -1) {
        const choiceIndex = newOptions[optionIndex].choices.findIndex(c => c.name === update.choiceName);
        if (choiceIndex !== -1) {
          newOptions[optionIndex].choices[choiceIndex].quantity = update.quantity;
        }
      }
    }

    // Recalculate total quantity and availability
    const totalQuantity = newOptions
      .flatMap(o => o.choices)
      .reduce((sum, choice) => sum + (choice.quantity ?? 0), 0);

    await ctx.db.patch(args.productId, {
      options: newOptions,
      quantity: totalQuantity,
      isAvailable: totalQuantity > 0,
    });
  },
});

export const deleteProduct = mutation({
  args: { 
    tokenIdentifier: v.string(),
    productId: v.id("products") 
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);

    const product = await ctx.db.get(args.productId);
    if (!product) return; // Item already deleted, do nothing.

    const store = await ctx.db.get(product.storeId);
    if (!store || store.ownerId !== user.tokenIdentifier) {
      throw new ConvexError("You do not have permission to delete products from this store.");
    }

    if (product.imageId) {
      await ctx.storage.delete(product.imageId);
    }
    if (product.imageIds) {
      await Promise.all(product.imageIds.map((id) => ctx.storage.delete(id)));
    }
    await ctx.db.delete(args.productId);

    // OPTIMIZATION: Decrement the store's totalProducts counter
    await ctx.db.patch(product.storeId, {
      totalProducts: Math.max(0, (store.totalProducts ?? 0) - 1),
    });
  },
});

export const getPopularProducts = query({
  args: { 
    storeId: v.id("stores"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const products = await ctx.db
      .query("products")
      .withIndex("by_store", q => q.eq("storeId", args.storeId))
      .filter(q => q.eq(q.field("isPopular"), true))
      .take(args.limit || 5);
    
    return await Promise.all(
      products.map(async (item) => ({
        ...item,
        imageUrl: item.imageId ? await ctx.storage.getUrl(item.imageId) : null,
      }))
    );
  },
});

export const searchProducts = query({
  args: {
    searchTerm: v.string(),
    storeId: v.optional(v.id("stores")),
  },
  handler: async (ctx, args) => {
    let searchQuery = ctx.db.query("products").withSearchIndex("search_all", q => 
      q.search("name", args.searchTerm)
    );
    
    if (args.storeId) {
      searchQuery = searchQuery.filter(q => q.eq(q.field("storeId"), args.storeId));
    }
    
    const products = await searchQuery.take(20);
    
    return await Promise.all(
      products.map(async (item) => ({
        ...item,
        imageUrl: item.imageId ? await ctx.storage.getUrl(item.imageId) : null,
      }))
    );
  },
});

export const getDiverseProducts = query({
  args: {
    limit: v.optional(v.number()),
    storeType: v.optional(v.string()),
    categories: v.optional(v.array(v.string())),
    country: v.optional(v.string()),
    region: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;

    // 1. Build a query for stores based on filters
    let storeQuery;
    // Apply location filters if provided
    if (args.country && args.region) {
      if (args.storeType) {
        // OPTIMIZATION: Use the composite index for direct lookup
        storeQuery = ctx.db
          .query("stores")
          .withIndex("by_region_type", (q) => q.eq("country", args.country!).eq("region", args.region!).eq("storeType", args.storeType as any));
      } else {
        storeQuery = ctx.db
          .query("stores")
          .withIndex("by_region", (q) => q.eq("country", args.country!).eq("region", args.region!));
      }
    } else {
      storeQuery = ctx.db.query("stores");
      // Fallback filter if no location provided (rare case)
      if (args.storeType) {
        storeQuery = storeQuery.filter((q) => q.eq(q.field("storeType"), args.storeType));
      }
    }

    let filteredStores = await storeQuery.take(20); // OPTIMIZATION: Reduced to 20 to lower load on high traffic

    // Post-fetch filtering for categories (intersection)
    if (args.categories && args.categories.length > 0) {
      filteredStores = filteredStores.filter(store =>
        args.categories!.every(cat => store.categories.includes(cat))
      );
    }

    if (filteredStores.length === 0) {
      return [];
    }

    // 2. Collect unique store IDs
    const storeIds = filteredStores.map(s => s._id);

    // 3. OPTIMIZED: Fetch recent products from each store individually instead of scanning all products
    // This avoids a full table scan on the products table which would be disastrous with 1M products.
    const productsPromises = storeIds.map(id => 
      ctx.db.query("products")
        .withIndex("by_store", q => q.eq("storeId", id))
        .order("desc")
        .take(3) // Take top 3 from each store to ensure diversity and performance
    );

    const productsPerStore = await Promise.all(productsPromises);
    
    // Flatten, sort by creation time (descending), and take the limit
    const products = productsPerStore.flat().sort((a, b) => b._creationTime - a._creationTime).slice(0, limit);

    const storesMap = new Map(filteredStores.map(store => [store._id, store]));

    // 4. Combine products with their store data and image URLs
    const results = await Promise.all(
      products.map(async (product) => {
        const store = storesMap.get(product.storeId);
        if (!store) {
          return null; // Skip product if store is not found
        }

        const [imageUrls, storeImageUrl] = await Promise.all([
          product.imageIds ? Promise.all(product.imageIds.map(id => ctx.storage.getUrl(id))) : [],
          store.logoImageId ? ctx.storage.getUrl(store.logoImageId) : null,
        ]);

        return {
          ...product,
          imageUrls: (imageUrls || []).filter((url): url is string => url !== null),
          storeId: store._id,
          storeName: store.name,
          storeImageUrl,
          storeRating: store.rating,
          totalReviews: store.totalReviews,
        };
      })
    );

    return results.filter(Boolean); // Filter out any null results
  },
});