import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
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
      .take(50); // OPTIMIZATION: Limit unread count fetch to 50
  },
});

export const getNotifications = query({
  args: { 
    tokenIdentifier: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    if (!args.tokenIdentifier) return { page: [], isDone: true, continueCursor: "" };
    const user = await validateToken(ctx, args.tokenIdentifier).catch(() => null);
    if (!user) return { page: [], isDone: true, continueCursor: "" };

    const result = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .paginate(args.paginationOpts);

    // Enrich notifications with store names
    return {
      ...result,
      page: await Promise.all(
        result.page.map(async (n) => {
        const store = n.storeId ? await ctx.db.get(n.storeId) : null;
        return {
          ...n,
          storeName: store?.name,
        };
      })
      )
    };
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

// Security: Make this internal so clients cannot spam notifications to other users.
export const create = internalMutation({
  args: {
    userId: v.id("users"),
    storeId: v.optional(v.id("stores")),
    orderId: v.optional(v.id("orders")),
    message: v.string(),
    type: v.union(
      v.literal("new_order"),
      v.literal("status_update"),
      v.literal("promotion"),
      v.literal("driver_application"),
      v.literal("report")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("notifications", {
      ...args,
      isRead: false,
    });
  },
});