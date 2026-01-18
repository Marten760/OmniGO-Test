import { mutation, query, action, internalMutation, internalQuery, QueryCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { validateToken } from "./util";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

const storeRegistrationArgs = {
  name: v.string(),
  description: v.string(),
  categories: v.array(v.string()),
  storeType: v.union(
    v.literal("restaurant"),
    v.literal("pharmacy"),
    v.literal("grocery"),
    v.literal("electronics"),
    v.literal("clothing"),
    v.literal("games"),
    v.literal("services"),
    v.literal("other")
  ),
  priceRange: v.array(v.string()),
  address: v.string(),
  latitude: v.optional(v.number()),
  longitude: v.optional(v.number()),
  country: v.string(),
  region: v.string(),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
  openingHours: v.array(
    v.object({
      day: v.string(),
      isOpen: v.boolean(),
      open: v.string(),
      close: v.string(),
    })
  ),
  hasDelivery: v.boolean(),
  dietaryOptions: v.array(v.string()),
  hasOffer: v.boolean(),
  offerText: v.optional(v.string()),
  logoImageId: v.id("_storage"),
  galleryImageIds: v.optional(v.array(v.id("_storage"))),
  ownerId: v.string(), // إضافة ownerId للربط
  deliveryRegions: v.optional(v.array(v.string())),
  isDeliveryRegionsAllowList: v.optional(v.boolean()),
};

export const registerStore = action({
  args: storeRegistrationArgs,
  handler: async (ctx, args): Promise<Id<"stores">> => {
    // استدعاء الـ mutation للتحقق من المستخدم وإنشاء المتجر
    const storeId = await ctx.runMutation(internal.stores.createStore, { 
      ...args
    });
    return storeId;
  },
});


export const createStore = internalMutation({
  args: {
    ...storeRegistrationArgs,
    ownerId: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"stores">> => {
    // التحقق من وجود المستخدم في قاعدة البيانات
    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", args.ownerId))
      .unique();
    
    if (!user) {
      throw new Error("User not found in database.");
    }

    // Fetch the user's profile to automatically get the walletAddress
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    // Use the walletAddress from the profile if it exists
    const piWalletAddress = profile?.walletAddress ?? undefined;
    const piUid = profile?.piUid ?? undefined; // Get the piUid as well

    const storeId = await ctx.db.insert("stores", {
      ...args,
      ownerId: args.ownerId,
      piWalletAddress: piWalletAddress, // Automatically add the wallet address
      piUid: piUid, // Automatically add the piUid
      // Set default values for required fields not in the form
      rating: 0,
      totalReviews: 0,
      isRecruitingDrivers: false, // Default to not recruiting
      isOpen: true,
      isTrending: false,
    });

    return storeId;
  },
});

export const getStores = query({
  args: {
    country: v.string(),
    region: v.string(),
    storeType: v.optional(v.string()), // Add storeType to the arguments
    categories: v.optional(v.array(v.string())),
    priceRange: v.optional(v.array(v.string())), // Changed to array
    hasDelivery: v.optional(v.boolean()),
    sortBy: v.optional(v.string()),
    rating: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Fetch all stores in the country to allow filtering by delivery regions
    const storesInCountry = await ctx.db
      .query("stores")
      .withIndex("by_region", (q) => q.eq("country", args.country))
      .collect();

    let stores = storesInCountry.filter((store) => {
      // Filter by Store Type
      if (args.storeType && store.storeType !== args.storeType) return false;

      // Filter by Rating
      if (args.rating && store.rating < args.rating) return false;

      // Location & Delivery Logic
      const userRegion = args.region;
      const isPhysicallyInRegion = store.region === userRegion;

      // Check if store delivers to user's region
      let deliversToUser = false;
      if (store.hasDelivery) {
        if (store.deliveryRegions && store.deliveryRegions.length > 0) {
          const isAllowList = store.isDeliveryRegionsAllowList ?? true;
          const isInList = store.deliveryRegions.includes(userRegion);
          deliversToUser = isAllowList ? isInList : !isInList;
        } else {
          // Default: delivers to own region
          deliversToUser = isPhysicallyInRegion;
        }
      }

      // Apply filter based on user preference
      if (args.hasDelivery === true) {
        // User wants delivery: Must deliver to user
        return deliversToUser;
      } else if (args.hasDelivery === false) {
        // User wants pickup: Must be in user's region
        return isPhysicallyInRegion;
      } else {
        // No preference: Show if delivers OR is local (for pickup)
        return deliversToUser || isPhysicallyInRegion;
      }
    });

    // Post-fetch filtering for categories (intersection)
    if (args.categories && args.categories.length > 0) {
      stores = stores.filter(store =>
        args.categories!.every(cat => store.categories.includes(cat))
      );
    }

    // Post-fetch filtering for priceRange (intersection)
    if (args.priceRange && args.priceRange.length > 0) {
      stores = stores.filter(store =>
        args.priceRange!.some(price => store.priceRange.includes(price))
      );
    }

    // Add image URLs
    return Promise.all(
      stores.map(async (store) => ({
        ...store,
        imageUrl: store.logoImageId ? await ctx.storage.getUrl(store.logoImageId) : null,
      }))
    );
  },
});

export const getUserStores = query({
  args: { tokenIdentifier: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.tokenIdentifier) {
      return [];
    }

    // Validate the token to ensure the user exists before querying for stores.
    await validateToken(ctx, args.tokenIdentifier);

    const stores = await ctx.db
      .query("stores")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.tokenIdentifier!))
      .collect();

    // Get the latest user profile to ensure wallet data is up-to-date
    const user = await ctx.db.query("users").withIndex("by_tokenIdentifier", q => q.eq("tokenIdentifier", args.tokenIdentifier!)).unique();
    const profile = user ? await ctx.db.query("userProfiles").withIndex("by_user", q => q.eq("userId", user._id)).unique() : null;

    // Get product counts for all stores in a more efficient way
    const storesWithProductCounts = await Promise.all(
      stores.map(async (store) => {
        const products = await ctx.db.query("products").withIndex("by_store", q => q.eq("storeId", store._id)).collect();
        // Override the store's piUid and wallet address with the latest from the user's profile
        return { 
          ...store, 
          productCount: products.length,
          piUid: profile?.piUid,
          piWalletAddress: profile?.walletAddress,
        };
      })
    );

    return Promise.all(
      storesWithProductCounts.map(async (store) => ({
        ...store,
        imageUrl: store.logoImageId ? await ctx.storage.getUrl(store.logoImageId) : null,
        galleryImageUrls: store.galleryImageIds 
          ? await Promise.all(store.galleryImageIds.map(id => ctx.storage.getUrl(id))) 
          : [],
      }))
    );
  },
});

/**
 * Checks if a user owns at least one store.
 * This is more efficient than fetching all stores.
 */
export const checkUserHasStore = query({
  args: { tokenIdentifier: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.tokenIdentifier) {
      return false;
    }
    await validateToken(ctx, args.tokenIdentifier);
    const store = await ctx.db
      .query("stores")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.tokenIdentifier!))
      .first(); // .first() is faster as it stops after finding one
    return !!store;
  },
});

export const getStoreById = query({
  args: { storeId: v.id("stores") },
  handler: async (ctx, args) => {
    const store = await ctx.db.get(args.storeId);
    if (!store) return null;
    return {
      ...store,
      imageUrl: store.logoImageId ? await ctx.storage.getUrl(store.logoImageId) : null,
      galleryImageUrls: store.galleryImageIds
        ? await Promise.all(store.galleryImageIds.map((id) => ctx.storage.getUrl(id)))
        : [],
    };
  },
});

/**
 * Internal query to get store data needed for payouts.
 * This is separate to avoid exposing sensitive data like wallet addresses to the client.
 */
export const getStoreForPayout = internalQuery({
  args: { storeId: v.id("stores") },
  handler: async (ctx, args) => await ctx.db.get(args.storeId),
});

export const toggleStoreStatus = mutation({
  args: {
    tokenIdentifier: v.string(),
    storeId: v.id("stores"),
    isOpen: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);

    const store = await ctx.db.get(args.storeId);
    if (!store || store.ownerId !== user.tokenIdentifier) {
      throw new ConvexError("Not authorized to update this store.");
    }

    await ctx.db.patch(args.storeId, { isOpen: args.isOpen });
  },
});

export const toggleDriverRecruitment = mutation({
  args: {
    tokenIdentifier: v.string(),
    storeId: v.id("stores"),
    isRecruiting: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);

    const store = await ctx.db.get(args.storeId);
    if (!store || store.ownerId !== user.tokenIdentifier) {
      throw new ConvexError("Not authorized to update this store.");
    }

    await ctx.db.patch(args.storeId, { isRecruitingDrivers: args.isRecruiting });
    return { success: true };
  },
});

export const updateStore = mutation({
  args: {
    tokenIdentifier: v.string(),
    storeId: v.id("stores"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    categories: v.optional(v.array(v.string())),
    storeType: v.optional(v.union(
      v.literal("restaurant"),
      v.literal("pharmacy"),
      v.literal("grocery"),
      v.literal("electronics"),
      v.literal("clothing"),
      v.literal("games"),
      v.literal("services"),
      v.literal("other")
    )),
    priceRange: v.optional(v.array(v.string())),
    address: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    country: v.optional(v.string()),
    region: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    openingHours: v.optional(v.array(
      v.object({
        day: v.string(),
        isOpen: v.boolean(),
        open: v.string(),
        close: v.string(),
      })
    )),
    hasDelivery: v.optional(v.boolean()),
    dietaryOptions: v.optional(v.array(v.string())),
    hasOffer: v.optional(v.boolean()),
    offerText: v.optional(v.string()),
    logoImageId: v.optional(v.id("_storage")),
    galleryImageIds: v.optional(v.array(v.id("_storage"))),
    piWalletAddress: v.optional(v.string()),
    deliveryRegions: v.optional(v.array(v.string())),
    isDeliveryRegionsAllowList: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);

    const store = await ctx.db.get(args.storeId);
    if (!store || store.ownerId !== user.tokenIdentifier) {
      throw new Error("Not authorized to update this store");
    }

    const { storeId, tokenIdentifier, ...updates } = args;
    await ctx.db.patch(storeId, updates);
  },
});

/**
 * Internal mutation to update the wallet address for all stores owned by a user.
 * This is called on login to ensure all stores are up-to-date.
 */
export const updateStoreWalletsOnProfileUpdate = internalMutation({
  args: {
    tokenIdentifier: v.string(),
    walletAddress: v.optional(v.string()),
    piUid: v.optional(v.string()), // Add piUid to the arguments
  },
  handler: async (ctx, args) => {
    // No need to validate user here as it's an internal mutation called from a trusted source (auth)

    // Fetch all stores owned by this user
    const stores = await ctx.db
      .query("stores")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.tokenIdentifier))
      .collect();

    // Update each store with the new wallet address if it's provided
    if (stores.length > 0) {
      console.log(`[updateStoreWallets] Updating ${stores.length} stores with new UID: ${args.piUid}`);
      await Promise.all(
        stores.map(store => {
          const updatePayload: any = { piUid: args.piUid };
          if (args.walletAddress) {
            updatePayload.piWalletAddress = args.walletAddress;
          }
          return ctx.db.patch(store._id, updatePayload);
        })
      );
      console.log(`Updated wallet and UID for ${stores.length} stores owned by user.`);
    }
  },
});

export const deleteStore = mutation({
  args: {
    storeId: v.id("stores"),
    tokenIdentifier: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);

    const store = await ctx.db.get(args.storeId);
    if (!store) {
      throw new ConvexError("Store not found.");
    }

    if (store.ownerId !== user.tokenIdentifier) {
      throw new ConvexError("Not authorized to delete this store.");
    }

    // Check for active orders before deletion
    const activeOrder = await ctx.db
      .query("orders")
      .withIndex("by_store_creation_time", (q) => q.eq("storeId", args.storeId))
      .filter((q) =>
        q.and(
          q.neq(q.field("status"), "delivered"),
          q.neq(q.field("status"), "cancelled")
        )
      )
      .first();

    if (activeOrder) {
      throw new ConvexError("Cannot delete store. There are active orders that must be completed first.");
    }

    // --- Delete associated storage files (Store Logo & Gallery) ---
    if (store.logoImageId) await ctx.storage.delete(store.logoImageId);
    if (store.galleryImageIds) await Promise.all(store.galleryImageIds.map((id) => ctx.storage.delete(id)));

    // --- Delete associated data ---

    // Delete products and their images
    const products = await ctx.db.query("products").withIndex("by_store", q => q.eq("storeId", args.storeId)).collect();
    await Promise.all(products.map(async (p) => {
      if (p.imageId) await ctx.storage.delete(p.imageId);
      if (p.imageIds) await Promise.all(p.imageIds.map((id) => ctx.storage.delete(id)));
      await ctx.db.delete(p._id);
    }));

    // Delete product categories
    const categories = await ctx.db.query("productCategories").withIndex("by_store", q => q.eq("storeId", args.storeId)).collect();
    await Promise.all(categories.map(c => ctx.db.delete(c._id)));

    // Delete discounts
    const discounts = await ctx.db.query("discounts").withIndex("by_storeId", q => q.eq("storeId", args.storeId)).collect();
    await Promise.all(discounts.map(d => ctx.db.delete(d._id)));

    // Delete orders
    const orders = await ctx.db.query("orders").withIndex("by_store_creation_time", q => q.eq("storeId", args.storeId)).collect();
    await Promise.all(orders.map(o => ctx.db.delete(o._id)));

    // Delete reviews and their images
    const reviews = await ctx.db.query("reviews").withIndex("by_store", q => q.eq("storeId", args.storeId)).collect();
    await Promise.all(reviews.map(async (r) => {
      if (r.imageIds) await Promise.all(r.imageIds.map((id) => ctx.storage.delete(id)));
      await ctx.db.delete(r._id);
    }));

    // Delete follows for this store
    const follows = await ctx.db.query("follows").withIndex("by_store", q => q.eq("storeId", args.storeId)).collect();
    await Promise.all(follows.map(f => ctx.db.delete(f._id)));

    // Delete promotions and their images
    const promotions = await ctx.db.query("promotions").withIndex("by_store", q => q.eq("storeId", args.storeId)).collect();
    await Promise.all(promotions.map(async (p) => {
      if (p.imageId) await ctx.storage.delete(p.imageId);
      await ctx.db.delete(p._id);
    }));

    // Delete store drivers links
    const drivers = await ctx.db.query("storeDrivers").withIndex("by_store", q => q.eq("storeId", args.storeId)).collect();
    await Promise.all(drivers.map(d => ctx.db.delete(d._id)));

    // Delete payouts
    const payouts = await ctx.db.query("payouts").withIndex("by_store", q => q.eq("storeId", args.storeId)).collect();
    await Promise.all(payouts.map(p => ctx.db.delete(p._id)));

    // Delete campaigns
    const campaigns = await ctx.db.query("campaigns").withIndex("by_storeId", q => q.eq("storeId", args.storeId)).collect();
    await Promise.all(campaigns.map(c => ctx.db.delete(c._id)));

    // Finally, delete the store itself
    await ctx.db.delete(args.storeId);

    return { success: true };
  },
});

export const searchStores = query({
  args: {
    searchTerm: v.string(),
    country: v.string(),
    region: v.string(),
    piWalletAddress: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.searchTerm) return [];
    
    // Search by name and country only (omit region to find stores delivering from elsewhere)
    const stores = await ctx.db.query("stores")
      .withSearchIndex("search_all", q => q.search("name", args.searchTerm).eq("country", args.country))
      .take(20);

    // Filter by delivery/location logic
    const filteredStores = stores.filter(store => {
      const userRegion = args.region;
      const isPhysicallyInRegion = store.region === userRegion;
      
      let deliversToUser = false;
      if (store.hasDelivery) {
        if (store.deliveryRegions && store.deliveryRegions.length > 0) {
          const isAllowList = store.isDeliveryRegionsAllowList ?? true;
          const isInList = store.deliveryRegions.includes(userRegion);
          deliversToUser = isAllowList ? isInList : !isInList;
        } else {
          deliversToUser = isPhysicallyInRegion;
        }
      }
      
      return deliversToUser || isPhysicallyInRegion;
    });

    return Promise.all(filteredStores.map(async (store) => ({
      ...store,
      imageUrl: store.logoImageId ? await ctx.storage.getUrl(store.logoImageId) : null,
    })));
  },
});

// Migration to convert priceRange from string to array
export const migratePriceRangeToArray = internalMutation({
  args: {}, // No arguments needed, it will iterate over all stores
  handler: async (ctx) => {
    // Get all stores
    const allStores = await ctx.db.query("stores").collect();

    // Filter for stores where priceRange is a non-empty string and update them
    const updates = allStores
      .filter(store => typeof (store as any).priceRange === 'string' && (store as any).priceRange.trim().length > 0)
      .map(store => {
        // Convert the string to a single-element array, trimming whitespace
        const newPriceRange = [(store as any).priceRange.trim()];
        return ctx.db.patch(store._id, { priceRange: newPriceRange });
      });

    if (updates.length > 0) {
      await Promise.all(updates); // Execute all updates in parallel
      console.log(`Migration successful: Updated ${updates.length} stores to use an array for priceRange.`);
      return { success: true, updatedCount: updates.length };
    }

    console.log("Migration check complete: No stores needed updating.");
    return { success: true, updatedCount: 0 };
  },
});

// Helper function to calculate distance in km using Haversine formula
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

export const calculateDeliveryFee = query({
  args: {
    storeId: v.id("stores"),
    userLatitude: v.number(),
    userLongitude: v.number(),
  },
  handler: async (ctx, args) => {
    const store = await ctx.db.get(args.storeId);
    if (!store || store.latitude == null || store.longitude == null) return null;

    const distance = getDistanceFromLatLonInKm(store.latitude, store.longitude, args.userLatitude, args.userLongitude);
    
    // Distance * PricePerKm (No Base Fee)
    
    // Fetch global price per km from app settings
    const setting = await ctx.db.query("appSettings").withIndex("by_key", q => q.eq("key", "deliveryPricePerKm")).unique();
    const perKmFee = setting?.value ?? 0.5; // Default to 0.5 Pi if not set
    
    return distance * perKmFee;
  },
});

export const setDeliveryPricePerKm = mutation({
  args: { price: v.number() },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("appSettings").withIndex("by_key", q => q.eq("key", "deliveryPricePerKm")).unique();
    if (existing) {
      await ctx.db.patch(existing._id, { value: args.price });
    } else {
      await ctx.db.insert("appSettings", { key: "deliveryPricePerKm", value: args.price });
    }
  },
});