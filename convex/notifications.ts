import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { validateToken } from "./util";

// Query to get unread notifications for the logged-in user
export const getUnreadNotifications = query({
  args: { tokenIdentifier: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.tokenIdentifier) return [];
    const user = await validateToken(ctx, args.tokenIdentifier).catch(() => null);
    if (!user) return [];

    return await ctx.db
      .query("notifications")
      .withIndex("by_user_read_status", (q) => q.eq("userId", user._id).eq("isRead", false))
      .order("desc")
      .collect();
  },
});

export const getNotifications = query({
  args: { tokenIdentifier: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.tokenIdentifier) return [];
    const user = await validateToken(ctx, args.tokenIdentifier).catch(() => null);
    if (!user) return [];

    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    // Enrich notifications with store names
    return Promise.all(
      notifications.map(async (n) => {
        const store = n.storeId ? await ctx.db.get(n.storeId) : null;
        return {
          ...n,
          storeName: store?.name,
        };
      })
    );
  },
});

// Mutation to mark a notification as read
export const markAsRead = mutation({
  args: { 
    tokenIdentifier: v.string(),
    notificationId: v.id("notifications") 
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);

    const notification = await ctx.db.get(args.notificationId);
    if (!notification || notification.userId !== user._id) {
      throw new Error("Notification not found or you don't have permission.");
    }

    await ctx.db.patch(args.notificationId, { isRead: true });
  },
});

// Mutation to mark all notifications as read
export const markAllAsRead = mutation({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);

    const unreadNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_user_read_status", (q) => q.eq("userId", user._id).eq("isRead", false))
      .collect();

    await Promise.all(
      unreadNotifications.map((notification) =>
        ctx.db.patch(notification._id, { isRead: true })
      )
    );
  },
});

export const create = mutation({
  args: {
    userId: v.id("users"),
    storeId: v.optional(v.id("stores")),
    orderId: v.optional(v.id("orders")),
    message: v.string(),
    type: v.union(v.literal("new_order"), v.literal("status_update"), v.literal("promotion")),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("notifications", {
      ...args,
      isRead: false,
    });
  },
});