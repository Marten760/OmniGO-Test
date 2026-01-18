import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { validateToken } from "./util";
import { internal } from "./_generated/api";

/**
 * Internal mutation to create a payment record.
 * This should be called before attempting to approve with Pi.
 */
export const createPaymentRecord = internalMutation({
  args: {
    paymentId: v.string(),
    userId: v.id("users"),
    amount: v.number(),
    memo: v.string(),
    metadata: v.any(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("piPayments", {
      ...args,
      // txid will be added later on completion
    });
  },
});

/**
 * Internal mutation to update payment status and optional txid/failureReason.
 */
export const updatePaymentStatus = internalMutation({
  args: {
    paymentId: v.string(),
    status: v.string(),
    txid: v.optional(v.string()),
    failureReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const payment = await ctx.db
      .query("piPayments")
      .withIndex("by_payment_id", (q) => q.eq("paymentId", args.paymentId))
      .first();
    if (!payment) {
      // Don't throw error, just warn, as webhooks might be duplicated.
      console.warn(`[updatePaymentStatus] Payment ${args.paymentId} not found.`);
      return;
    }
    await ctx.db.patch(payment._id, {
      status: args.status,
      txid: args.txid,
      failureReason: args.failureReason,
    });
  },
});

/**
 * Internal mutation to process a completed payment (create order, trigger payout).
 */
export const processCompletedPayment = internalMutation({
  args: {
    paymentId: v.string(),
    payment: v.any(), // Full payment object from Pi API
  },
  handler: async (ctx, args) => {
    const payment = await ctx.db
      .query("piPayments")
      .withIndex("by_payment_id", (q) => q.eq("paymentId", args.paymentId))
      .first();
    if (!payment || !payment.userId) {
      console.warn(`[processCompletedPayment] Payment ${args.paymentId} not found in DB or has no user.`);
      return;
    }

    if (payment.status !== 'completed') {
        console.warn(`[processCompletedPayment] Payment ${args.paymentId} is not completed. Status: ${payment.status}. Skipping.`);
        return;
    }

    const existingOrder = await ctx.db
      .query("orders")
      .withIndex("by_pi_payment_id", (q) => q.eq("piPaymentId", args.paymentId))
      .first();
    if (existingOrder) {
      console.log(`[processCompletedPayment] Order for payment ${args.paymentId} already exists. Skipping creation.`);
      return;
    }

    const orderId = await ctx.runMutation(internal.orders.createOrderFromPayment, {
      userId: payment.userId,
      paymentAmount: payment.amount,
      paymentMetadata: payment.metadata,
      piPaymentId: args.paymentId,
      paymentRecordId: payment._id,
    });

    if (orderId) {
      if (!payment.orderId) {
        await ctx.db.patch(payment._id, { orderId });
      }
      await ctx.db.patch(orderId, {
        status: "confirmed",
        paymentStatus: "paid",
        txid: args.payment.txid,
      });
      // ESCROW IMPLEMENTATION:
      // We do NOT trigger payoutToStore here anymore.
      // The funds are now "Held" in the App Wallet until the order is marked as 'delivered'.
    }
  },
});

/**
 * Internal mutation to record a payout transaction in the database.
 */
export const recordPayout = internalMutation({
  args: {
    storeId: v.id("stores"),
    orderId: v.id("orders"),
    amount: v.number(),
    txid: v.optional(v.string()),
    status: v.string(),
    failureReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("payouts", args);
  },
});

/**
 * Starts a payout process ensuring idempotency.
 * Checks if a payout is already completed or in progress.
 */
export const startPayout = internalMutation({
  args: {
    storeId: v.id("stores"),
    orderId: v.id("orders"),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    // Check for ANY existing payout for this order
    const existing = await ctx.db.query("payouts")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .first();
    
    if (existing) {
      if (existing.status === "completed") {
        return { status: "already_completed", txid: existing.txid };
      }

      if (existing.status === "processing") {
         // If created less than 2 minutes ago, assume it's still running
         if (Date.now() - existing._creationTime < 2 * 60 * 1000) {
            return { status: "in_progress" };
         }
      }

      await ctx.db.patch(existing._id, {
        status: "processing",
        failureReason: undefined,
        txid: undefined,
      });
      return { status: "started", payoutId: existing._id };
    }

    const payoutId = await ctx.db.insert("payouts", {
      storeId: args.storeId,
      orderId: args.orderId,
      amount: args.amount,
      status: "processing",
    });

    return { status: "started", payoutId };
  }
});

/**
 * Finalizes a payout status (completed or failed).
 */
export const finalizePayout = internalMutation({
  args: {
    payoutId: v.id("payouts"),
    status: v.string(),
    txid: v.optional(v.string()),
    failureReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.payoutId, {
      status: args.status,
      txid: args.txid,
      failureReason: args.failureReason,
    });
  },
});

export const getPaymentsByUser = query({
  args: {
    tokenIdentifier: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    if (!user) return [];
    return await ctx.db.query("piPayments").withIndex("by_user", (q) => q.eq("userId", user._id)).order("desc").take(args.limit || 10);
  },
});

export const getPaymentById = query({
  args: { paymentId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.query("piPayments").withIndex("by_payment_id", (q) => q.eq("paymentId", args.paymentId)).first();
  },
});

/**
 * Internal mutation to cancel a pending payment in the database.
 */
export const cancelPendingPayment = internalMutation({
  args: {
    paymentId: v.string(),
  },
  handler: async (ctx, args) => {
    const payment = await ctx.db
      .query("piPayments")
      .withIndex("by_payment_id", (q) => q.eq("paymentId", args.paymentId))
      .first();
    if (!payment) {
      console.warn(`[cancelPendingPayment] Payment ${args.paymentId} not found.`);
      return;
    }
    await ctx.db.patch(payment._id, {
      status: "cancelled",
      failureReason: "Cancelled due to pending state resolution",
    });
    console.log(`[cancelPendingPayment] Payment ${args.paymentId} cancelled in DB.`);
  },
});