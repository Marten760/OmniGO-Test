import { query } from "./_generated/server";
import { v } from "convex/values";

export const globalSearch = query({
  args: {
    query: v.string(),
    country: v.string(),
    region: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.query) {
      return { stores: [], products: [] };
    }

    const storesPromise = ctx.db
      .query("stores")
      .withSearchIndex("search_all", (q) =>
        q.search("name", args.query).eq("country", args.country).eq("region", args.region)
      )
      .take(5);

    const productsPromise = ctx.db
      .query("products")
      .withSearchIndex("search_all", (q) => q.search("name", args.query))
      .take(50); // Fetch more candidates to allow for location filtering

    const [unprocessedStores, unprocessedProducts] = await Promise.all([
      storesPromise,
      productsPromise,
    ]);

    // Add image URLs to stores
    const stores = await Promise.all(
      unprocessedStores.map(async (store) => ({
        ...store,
        imageUrl: store.logoImageId
          ? await ctx.storage.getUrl(store.logoImageId)
          : null,
      }))
    );

    // Enrich products with store data and image URLs
    const storeIds = [...new Set(unprocessedProducts.map(p => p.storeId))];
    const productStores = await Promise.all(
      storeIds.map((storeId) => ctx.db.get(storeId))
    );
    const storesMap = new Map(productStores.filter(Boolean).map(s => [s!._id, s]));

    // Filter products by location (must match user's country and region)
    const filteredProducts = unprocessedProducts.filter(product => {
      const store = storesMap.get(product.storeId);
      return store && store.country === args.country && store.region === args.region;
    }).slice(0, 10); // Take top 10 relevant results

    const products = await Promise.all(
      filteredProducts.map(async (product) => {
        const store = storesMap.get(product.storeId);
        const [imageUrls, storeImageUrl] = await Promise.all([
          product.imageIds ? Promise.all(product.imageIds.map(id => ctx.storage.getUrl(id))) : [],
          store?.logoImageId ? ctx.storage.getUrl(store.logoImageId) : null,
        ]);
        return {
          ...product,
          imageUrls: (imageUrls || []).filter((url): url is string => url !== null),
          storeName: store?.name ?? "Unknown Store",
          storeImageUrl,
          storeRating: store?.rating ?? 0,
          totalReviews: store?.totalReviews ?? 0,
        };
      })
    );

    return { stores, products };
  },
});