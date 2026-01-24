import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { validateToken } from "./util";
import { internal } from "./_generated/api";

export const getReportsByStore = query({
  args: {
    tokenIdentifier: v.string(),
    storeId: v.id("stores"),
    paginationOpts: paginationOptsValidator,
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
      .paginate(args.paginationOpts);

    return {
      ...reports,
      page: await Promise.all(
        reports.page.map(async (report) => {
        const order = await ctx.db.get(report.orderId);
        const reporter = await ctx.db.get(report.userId);
        const imageUrls = report.imageIds
          ? await Promise.all(report.imageIds.map((id) => ctx.storage.getUrl(id)))
          : [];

        return {
          ...report,
          orderNumber: order?._id?.slice(-6).toUpperCase() ?? "N/A",
          orderTotal: order?.totalAmount,
          reporterName: reporter?.name || "Anonymous",
          imageUrls: imageUrls.filter((u): u is string => u !== null),
        };
        })
      ),
    };
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

    // Find the conversation associated with this order
    const conversation = await ctx.db.query("conversations").withIndex("by_order", q => q.eq("orderId", order._id)).first();

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
      if (conversation) {
        await ctx.db.patch(conversation._id, { isArchived: true });
      }
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
      
      await ctx.db.patch(order._id, { 
        status: "delivered",
        paymentStatus: "released" // Ensure payment status is updated
      });
      if (conversation) {
        await ctx.db.patch(conversation._id, { isArchived: true });
      }
    }
  },
});