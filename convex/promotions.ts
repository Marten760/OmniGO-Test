import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import { validateToken } from "./util";
import { api } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";

export const createOrUpdatePromotion = mutation({
  args: {
    tokenIdentifier: v.string(),
    storeId: v.id("stores"),
    title: v.string(),
    description: v.optional(v.string()),
    imageId: v.id("_storage"),
    badgeText: v.optional(v.string()),
    targetStoreId: v.id("stores"),
    startDate: v.string(),
    endDate: v.string(),
    status: v.union(v.literal("active"), v.literal("draft")),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    const store = await ctx.db.get(args.storeId);

    if (!store || store.ownerId !== user.tokenIdentifier) {
      throw new Error("You are not authorized to manage promotions for this store.");
    }

    const { tokenIdentifier, ...promotionData } = args;

    const promotionId = await ctx.db.insert("promotions", promotionData);

    // Schedule an action to send notifications to followers
    if (args.status === 'active') {
      await ctx.scheduler.runAfter(0, api.promotions.sendPromotionNotifications, { promotionId });
    }

    return { success: true };
  },
});

export const getPromotionsByStore = query({
  args: {
    storeId: v.id("stores"),
  },
  handler: async (ctx, args) => {
    const promotions = await ctx.db // This query should fetch ALL promotions for the given store for management purposes
      .query("promotions")
      .withIndex("by_store", (q) => q.eq("storeId", args.storeId))
      .order("desc")
      .collect();

    return Promise.all(
      promotions.map(async (p) => ({ ...p, imageUrl: await ctx.storage.getUrl(p.imageId) }))
    );
  },
});

export const getActivePromotions = query({
  args: {
    storeType: v.optional(v.string()),
    categories: v.optional(v.array(v.string())),
    country: v.optional(v.string()),
    region: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();

    // 1. Build a query for stores based on filters
    let storeQuery;
    if (args.country && args.region) {
      storeQuery = ctx.db
        .query("stores")
        .withIndex("by_region", (q) => q.eq("country", args.country!).eq("region", args.region!));
    } else {
      storeQuery = ctx.db.query("stores");
    }

    if (args.storeType) {
      storeQuery = storeQuery.filter((q) => q.eq(q.field("storeType"), args.storeType));
    }

    let filteredStores = await storeQuery.collect();

    if (args.categories && args.categories.length > 0) {
      filteredStores = filteredStores.filter(store =>
        args.categories!.every(cat => store.categories.includes(cat))
      );
    }

    if (filteredStores.length === 0) {
      return [];
    }

    const storeIds = filteredStores.map(s => s._id);

    // 2. Fetch active promotions from these filtered stores
    const promotions = await ctx.db
      .query("promotions")
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "active"),
          q.lte(q.field("startDate"), now),
          q.gte(q.field("endDate"), now),
          q.or(...storeIds.map(id => q.eq(q.field("storeId"), id)))
        )
      )
      .order("desc")
      .collect();

    return Promise.all(promotions.map(async (p) => ({ ...p, imageUrl: await ctx.storage.getUrl(p.imageId) })));
  },
});



export const updatePromotion = mutation({
  args: {
    tokenIdentifier: v.string(),
    promotionId: v.id("promotions"),
    title: v.string(),
    description: v.optional(v.string()),
    imageId: v.optional(v.id("_storage")), // Make imageId optional for updates
    badgeText: v.optional(v.string()),
    startDate: v.string(),
    endDate: v.string(),
    status: v.union(v.literal("active"), v.literal("draft"), v.literal("archived")),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    const promotion = await ctx.db.get(args.promotionId);
    if (!promotion) throw new Error("Promotion not found.");

    const store = await ctx.db.get(promotion.storeId);
    if (!store || store.ownerId !== user.tokenIdentifier) {
      throw new Error("You are not authorized to update this promotion.");
    }

    const { promotionId, tokenIdentifier, ...updates } = args;
    await ctx.db.patch(promotionId, updates);
    return { success: true };
  },
});

export const sendPromotionNotifications = action({
  args: {
    promotionId: v.id("promotions"),
  },
  handler: async (ctx, args) => {
    const promotion = await ctx.runQuery(api.promotions.getPromotionById, { promotionId: args.promotionId });
    if (!promotion) {
      console.error(`Promotion ${args.promotionId} not found for sending notifications.`);
      return;
    }

    const followers = await ctx.runQuery(api.follows.getFollowers, { storeId: promotion.storeId });

    // Create a notification for each follower
    await Promise.all(
      followers.map((follower: Doc<"users">) => {
        return ctx.runMutation(api.notifications.create, {
          userId: follower._id,
          storeId: promotion.storeId,
          message: `New offer from ${promotion.storeName}: ${promotion.title}`,
          type: "promotion",
        });
      })
    );
  },
});

export const getPromotionById = query({
  args: { promotionId: v.id("promotions") },
  handler: async (ctx, args) => {
    const promotion = await ctx.db.get(args.promotionId);
    if (!promotion) return null;
    const store = await ctx.db.get(promotion.storeId);
    return {
      ...promotion,
      storeName: store?.name ?? "A Store",
    };
  },
});

export const deletePromotion = mutation({
  args: {
    tokenIdentifier: v.string(),
    promotionId: v.id("promotions"),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    const promotion = await ctx.db.get(args.promotionId);
    if (!promotion) return;

    const store = await ctx.db.get(promotion.storeId);
    if (!store || store.ownerId !== user.tokenIdentifier) {
      throw new Error("You are not authorized to delete this promotion.");
    }

    if (promotion.imageId) {
      await ctx.storage.delete(promotion.imageId);
    }

    await ctx.db.delete(args.promotionId);
    return { success: true };
  },
});