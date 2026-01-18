import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { validateToken } from "./util";
import { internal } from "./_generated/api";

export const getReportsByStore = query({
  args: {
    tokenIdentifier: v.string(),
    storeId: v.id("stores"),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    const store = await ctx.db.get(args.storeId);
    if (!store || store.ownerId !== user.tokenIdentifier) {
      throw new Error("Unauthorized");
    }

    const reports = await ctx.db
      .query("reports")
      .withIndex("by_store", (q) => q.eq("storeId", args.storeId))
      .order("desc")
      .collect();

    return Promise.all(
      reports.map(async (report) => {
        const order = await ctx.db.get(report.orderId);
        const reporter = await ctx.db.get(report.userId);
        const imageUrls = report.imageIds
          ? await Promise.all(report.imageIds.map((id) => ctx.storage.getUrl(id)))
          : [];

        return {
          ...report,
          orderNumber: order?._id.slice(-6).toUpperCase(),
          orderTotal: order?.totalAmount,
          reporterName: reporter?.name || "Anonymous",
          imageUrls: imageUrls.filter((u): u is string => u !== null),
        };
      })
    );
  },
});

export const resolveReport = mutation({
  args: {
    tokenIdentifier: v.string(),
    reportId: v.id("reports"),
    resolution: v.string(), // "refund" or "dismiss"
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    const report = await ctx.db.get(args.reportId);
    if (!report) throw new Error("Report not found");

    const store = await ctx.db.get(report.storeId);
    if (!store || store.ownerId !== user.tokenIdentifier) {
      throw new Error("Unauthorized");
    }

    if (report.status !== "open") {
      throw new Error("Report is already resolved");
    }

    const order = await ctx.db.get(report.orderId);
    if (!order) throw new Error("Order not found");

    if (args.resolution === "refund") {
      // Logic for refunding (mark as resolved, order cancelled/refunded)
      await ctx.db.patch(report._id, {
        status: "resolved",
        resolution: args.note || "Refunded by store",
      });
      await ctx.db.patch(order._id, {
        status: "cancelled",
        paymentStatus: "refunded",
      });
      
      // Trigger the refund action to send Pi back to the customer
      await ctx.scheduler.runAfter(0, internal.paymentsActions.refundToCustomer, {
        userId: order.userId,
        storeId: order.storeId,
        amount: order.totalAmount,
        orderId: order._id,
      });
    } else if (args.resolution === "dismiss") {
      // Logic for dismissing (mark as rejected, release payout)
      await ctx.db.patch(report._id, {
        status: "rejected",
        resolution: args.note || "Report dismissed by store",
      });
      
      const commissionRateString = process.env.APP_COMMISSION_RATE || '0.05';
      const appCommissionRate = parseFloat(commissionRateString);
      const payoutAmount = order.totalAmount * (1 - appCommissionRate);

      await ctx.scheduler.runAfter(0, internal.paymentsActions.payoutToStore, {
        storeId: order.storeId,
        amount: payoutAmount,
        orderId: order._id,
      });
      
      await ctx.db.patch(order._id, { status: "delivered" });
    }
  },
});
export const getOrCreateReportConversation = mutation({
  args: {
    tokenIdentifier: v.string(),
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");

    const store = await ctx.db.get(order.storeId);
    if (!store) throw new Error("Store not found");

    // Check authorization (user must be customer or store owner)
    const isCustomer = order.userId === user._id;
    const isStoreOwner = store.ownerId === user.tokenIdentifier;

    if (!isCustomer && !isStoreOwner) {
      throw new Error("Unauthorized");
    }

    // Find existing conversation for this order
    const existingConv = await ctx.db
      .query("conversations")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .first();

    if (existingConv) {
      if (existingConv.isArchived) {
        await ctx.db.patch(existingConv._id, { isArchived: false });
      }
      return existingConv._id;
    }

    // Create new conversation
    const storeOwnerUser = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", store.ownerId))
      .unique();
    
    if (!storeOwnerUser) throw new Error("Store owner user not found");

    const participants = [...new Set([order.userId, storeOwnerUser._id])];

    const conversationId = await ctx.db.insert("conversations", {
      participants: participants,
      orderId: args.orderId,
      updatedAt: Date.now(),
      unreadCounts: {},
      isArchived: false,
    });

    return conversationId;
  },
});