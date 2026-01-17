import { mutation, query, action, internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { api } from "./_generated/api";
import { validateToken } from "./util";

export const createDiscount = mutation({
  args: {
    tokenIdentifier: v.string(),
    storeId: v.id("stores"),
    code: v.string(),
    type: v.union(v.literal("percentage"), v.literal("fixed")),
    value: v.number(),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    minOrderValue: v.optional(v.number()),
    usageLimit: v.optional(v.number()),
    usageLimitPerUser: v.optional(v.number()),
    targetUsers: v.union(v.literal("all"), v.literal("new_users_only")),
  },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    // 1. Authentication & Authorization
    const user = await validateToken(ctx, args.tokenIdentifier);
    const store: Doc<"stores"> | null = await ctx.db.get(args.storeId);
    if (!store) {
      throw new Error("Store not found.");
    }

    if (store.ownerId !== user.tokenIdentifier) {
      throw new Error("You are not authorized to create discounts for this store.");
    }

    // 2. Validation
    if (args.value <= 0) {
        throw new Error("Discount value must be positive.");
    }
    if (args.type === 'percentage' && args.value > 100) {
        throw new Error("Percentage discount cannot exceed 100.");
    }
    if (args.startDate && args.endDate && new Date(args.startDate) > new Date(args.endDate)) {
        throw new Error("End date must be after start date.");
    }

    // Check for uniqueness of the code for this store (case-insensitive)
    const codeUpper = args.code.toUpperCase();
    const existingDiscount = await ctx.db
      .query("discounts")
      .withIndex("by_storeId_and_code", (q) =>
        q.eq("storeId", args.storeId).eq("code", codeUpper)
      )
      .first();

    if (existingDiscount) {
      throw new ConvexError(`A discount with the code "${args.code}" already exists for this store.`);
    }

    // 3. Insertion
    await ctx.db.insert("discounts", {
      storeId: args.storeId,
      code: codeUpper,
      type: args.type,
      value: args.value,
      startDate: args.startDate,
      endDate: args.endDate,
      minOrderValue: args.minOrderValue,
      usageLimit: args.usageLimit,
      usageLimitPerUser: args.usageLimitPerUser,
      timesUsed: 0,
      targetUsers: args.targetUsers,
      isActive: true, // By default, a new code is active. Can be changed later.
    });

    return { success: true };
  },
});

export const sendEmailCampaign = action({
  args: {
    tokenIdentifier: v.string(),
    storeId: v.id("stores"),
    subject: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; sentCount: number }> => {
    // Inside an action, we must use `runQuery` to access database queries.
    const user = await ctx.runQuery(api.auth.getUserFromToken, { tokenIdentifier: args.tokenIdentifier });
    if (!user) {
      throw new ConvexError("User not found or token is invalid.");
    }

    const store = await ctx.runQuery(api.stores.getStoreById, { storeId: args.storeId });
    if (!store || store.ownerId !== user.tokenIdentifier) {
      throw new ConvexError("You are not authorized to send campaigns for this store.");
    }

    // Call the query from the 'follows' module to avoid circular dependency
    const followers: Doc<"users">[] = await ctx.runQuery(api.follows.getFollowers, { storeId: args.storeId });
    const followerEmails: string[] = followers
      .map((f: Doc<"users">) => f.email)
      .filter((e): e is string => !!e);

    if (followerEmails.length === 0) {
      throw new ConvexError("This store has no followers with emails to send a campaign to.");
    }

    // NOTE: This is a mock implementation. In a real-world scenario, you would
    // use an email service provider like Resend, SendGrid, or Mailgun here.
    // For now, we will create an in-app notification for each follower.
    await Promise.all(
      followers.map(follower => 
        ctx.runMutation(api.notifications.create, {
          userId: follower._id,
          storeId: args.storeId,
          message: `${args.subject}: ${args.content}`,
          type: "promotion",
        })
      )
    );

    return { success: true, sentCount: followerEmails.length };
  },
});

export const applyDiscountToOrder = internalMutation({
  args: {
    code: v.string(),
    userId: v.id("users"),
    orderTotal: v.number(),
    storeId: v.id("stores"),
    tokenIdentifier: v.optional(v.string()),
    orderId: v.optional(v.id("orders")),  // إذا كان order موجود
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier!);
    if (user._id !== args.userId) throw new ConvexError("Unauthorized");

    // 1. احصل على discount
    const discount = await ctx.db
      .query("discounts")
      .withIndex("by_storeId_and_code", (q) => q.eq("storeId", args.storeId).eq("code", args.code.toUpperCase()))
      .first();

    if (!discount) throw new ConvexError("Invalid discount code");
    if (!discount.isActive) throw new ConvexError("Discount is inactive");
    if (args.orderTotal < (discount.minOrderValue || 0)) throw new ConvexError(`Minimum order value of ${discount.minOrderValue} is required.`);

    const now = Date.now();
    if (discount.startDate && now < new Date(discount.startDate).getTime()) throw new ConvexError("Discount not active yet");
    if (discount.endDate && now > new Date(discount.endDate).getTime()) throw new ConvexError("Discount has expired");

    // 2. تحقق Usage Limit الكلي
    if (discount.usageLimit && discount.timesUsed >= discount.usageLimit) {
      throw new ConvexError(`Discount usage limit (${discount.usageLimit}) has been reached.`);
    }

    // 3. تحقق per-user
    if (discount.usageLimitPerUser && discount.usageLimitPerUser > 0) {
      const userUsages = await ctx.db
        .query("discountUsages")
        .withIndex("by_discount_and_user", (q) => q.eq("discountId", discount._id).eq("userId", args.userId))
        .collect();
      if (userUsages.length >= discount.usageLimitPerUser) {
        throw new ConvexError(`You have already used this discount code the maximum number of times.`);
      }
    }

    // 4. تحقق new customers only
    if (discount.targetUsers === 'new_users_only') {
      const firstOrder = await ctx.db.query("orders").withIndex("by_user", (q) => q.eq("userId", args.userId)).first();
      if (firstOrder) throw new ConvexError("This discount is for new customers only.");
    }

    // 5. احسب الخصم
    let discountAmount = 0;
    if (discount.type === 'percentage') {
      discountAmount = Math.min((args.orderTotal * discount.value) / 100, args.orderTotal);
    } else {
      discountAmount = Math.min(discount.value, args.orderTotal);
    }

    // 6. سجل الاستخدام
    await ctx.db.insert("discountUsages", {
      discountId: discount._id,
      userId: args.userId,
      orderId: args.orderId,
      usedAt: now,
    });

    // 7. حدث timesUsed
    await ctx.db.patch(discount._id, { timesUsed: (discount.timesUsed || 0) + 1 });

    return {
      success: true,
      discountAmount,
      discount: {
        id: discount._id,
        type: discount.type,
        value: discount.value,
      },
    };
  },
});

export const validateDiscountCode = query({
  args: {
    code: v.string(),
    storeId: v.id("stores"),
    orderTotal: v.number(),
    // We don't need userId for validation if we are not checking per-user limits before application
    // If we need to check new-user status, we'd need the user.
  },
  handler: async (ctx, args) => {
    if (args.code.trim() === "") {
      return { isValid: false, message: "Please enter a discount code." };
    }

    const discount = await ctx.db
      .query("discounts")
      .withIndex("by_storeId_and_code", (q) => q.eq("storeId", args.storeId).eq("code", args.code.toUpperCase()))
      .first();

    if (!discount) {
      return { isValid: false, message: "This discount code does not exist." };
    }
    if (!discount.isActive) {
      return { isValid: false, message: "This discount is no longer active." };
    }
    if (args.orderTotal < (discount.minOrderValue || 0)) {
      return { isValid: false, message: `A minimum order of π${discount.minOrderValue} is required.` };
    }

    const now = Date.now();
    if (discount.startDate && now < new Date(discount.startDate).getTime()) {
      return { isValid: false, message: "This discount is not active yet." };
    }
    if (discount.endDate && now > new Date(discount.endDate).getTime()) {
      return { isValid: false, message: "This discount has expired." };
    }

    if (discount.usageLimit && discount.timesUsed >= discount.usageLimit) {
      return { isValid: false, message: "This discount has reached its total usage limit." };
    }

    // Note: Per-user and new-user checks are best done in the final `validateAndApplyDiscount` mutation
    // as they require the user's identity. This query provides a preliminary validation.

    let discountAmount = 0;
    if (discount.type === 'percentage') {
      discountAmount = (args.orderTotal * discount.value) / 100;
    } else { // fixed
      discountAmount = discount.value;
    }
    // Ensure discount doesn't exceed order total
    discountAmount = Math.min(discountAmount, args.orderTotal);


    return { isValid: true, message: "Discount applied!", discount: { id: discount._id, type: discount.type, value: discount.value } };
  }
});

export const getDiscountsByStore = query({
  args: {
    tokenIdentifier: v.optional(v.string()),
    storeId: v.id("stores"),
  },
  handler: async (ctx, args) => {
    if (!args.tokenIdentifier) return [];
    const user = await validateToken(ctx, args.tokenIdentifier).catch(() => null);
    const store = await ctx.db.get(args.storeId);
    if (!user || !store || store.ownerId !== user.tokenIdentifier) {
      return [];
    }

    const discounts = await ctx.db
      .query("discounts")
      .withIndex("by_storeId", (q) => q.eq("storeId", args.storeId))
      .order("desc")
      .collect();

    return discounts;
  },
});

export const updateDiscount = mutation({
  args: {
    tokenIdentifier: v.string(),
    discountId: v.id("discounts"),
    code: v.string(),
    type: v.union(v.literal("percentage"), v.literal("fixed")),
    value: v.number(),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    minOrderValue: v.optional(v.number()),
    usageLimit: v.optional(v.number()),
    usageLimitPerUser: v.optional(v.number()),
    targetUsers: v.union(v.literal("all"), v.literal("new_users_only")),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    const { discountId, tokenIdentifier, ...updates } = args;

    const existingDiscount = await ctx.db.get(discountId);
    if (!existingDiscount) {
      throw new Error("Discount not found.");
    }

    const store = await ctx.db.get(existingDiscount.storeId);
    if (!store || store.ownerId !== user.tokenIdentifier) {
      throw new Error("You are not authorized to update this discount.");
    }

    // Validate updates
    const codeUpper = updates.code.toUpperCase();
    const otherDiscountWithCode = await ctx.db
      .query("discounts")
      .withIndex("by_storeId_and_code", (q) =>
        q.eq("storeId", existingDiscount.storeId).eq("code", codeUpper)
      )
      .filter((q) => q.neq(q.field("_id"), discountId))
      .first();

    if (otherDiscountWithCode) {
      throw new Error(`A discount with the code "${updates.code}" already exists for this store.`);
    }

    await ctx.db.patch(discountId, { ...updates, code: codeUpper });
    return { success: true };
  },
});

export const deleteDiscount = mutation({
  args: {
    tokenIdentifier: v.string(),
    discountId: v.id("discounts"),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    const existingDiscount = await ctx.db.get(args.discountId);
    if (!existingDiscount) {
      // Already deleted, so we can consider it a success.
      return { success: true };
    }

    const store = await ctx.db.get(existingDiscount.storeId);
    if (!store || store.ownerId !== user.tokenIdentifier) {
      throw new Error("You are not authorized to delete this discount.");
    }

    await ctx.db.delete(args.discountId);
    return { success: true };
  },
});