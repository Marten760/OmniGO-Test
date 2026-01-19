import { query, mutation, internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { validateToken } from "./util";

export const getOrdersByUser = query({
  args: { tokenIdentifier: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.tokenIdentifier) {
      return [];
    }
    const user = await validateToken(ctx, args.tokenIdentifier);

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    return orders;
  },
});

export const getUserOrderStats = query({
  args: { tokenIdentifier: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.tokenIdentifier) {
      return { totalOrders: 0, totalSpent: 0 };
    }
    const user = await validateToken(ctx, args.tokenIdentifier);

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const totalOrders = orders.length;
    const totalSpent = orders.reduce((sum, order) => sum + order.totalAmount, 0);

    return {
      totalOrders,
      totalSpent,
    };
  },
});

export const getRecentOrdersByStore = query({
  args: {
    tokenIdentifier: v.string(),
    storeId: v.id("stores"),
    searchTerm: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    const store = await ctx.db.get(args.storeId);
    if (!store || store.ownerId !== user.tokenIdentifier) {
      throw new Error("Not authorized to view orders for this store");
    }

    let orders;
    if (args.searchTerm && args.searchTerm.length > 0) {
      // If a search term is provided, use the search index.
      orders = await ctx.db
        .query("orders")
        .withSearchIndex("search_customer_name", (q) =>
          q.search("customerName", args.searchTerm!).eq("storeId", args.storeId)
        )
        .take(20);
    } else {
      // Otherwise, fetch the most recent orders.
      orders = await ctx.db
        .query("orders")
        .withIndex("by_store_creation_time", (q) => q.eq("storeId", args.storeId))
        .order("desc")
        .take(20);
    }


    // Efficiently get all unique customer IDs from the orders
    const customerIds = [...new Set(orders.map(order => order.userId))];

    // Fetch all required user profiles in a single query if there are any customers
    const customerProfiles = customerIds.length > 0 
      ? await ctx.db.query("userProfiles").filter(q => q.or(...customerIds.map(id => q.eq(q.field("userId"), id)))).collect()
      : [];
    
    // Create a map for quick lookups
    const profilesByUserId = new Map(customerProfiles.map(p => [p.userId, p]));

    const ordersWithCustomerNames = await Promise.all(
      orders.map(async (order) => {
        const customerProfile = profilesByUserId.get(order.userId);
        return {
          ...order,
          // Prioritize full name, then Pi username, then a fallback.
          customerName: 
            [customerProfile?.firstName, customerProfile?.lastName].filter(Boolean).join(' ') ||
            customerProfile?.piUsername ||
            "Anonymous User",
          deliveryAddress: order.deliveryAddress
        };
      })
    );

    return ordersWithCustomerNames;
  },
});

export const updateOrderStatus = mutation({
  args: {
    tokenIdentifier: v.string(),
    orderId: v.id("orders"),
    status: v.union(
      v.literal("confirmed"),
      v.literal("preparing"),
      v.literal("out_for_delivery"),
      v.literal("delivered"),
      v.literal("cancelled")
    ),
    driverId: v.optional(v.id("users")), // Optional: for assigning a driver
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    const userProfile = await ctx.db.query("userProfiles").withIndex("by_user", q => q.eq("userId", user._id)).unique();
    const isDriver = userProfile?.roles?.includes("driver");

    const store = await ctx.db.get(order.storeId);
    const isOwner = store?.ownerId === user.tokenIdentifier;

    // Authorization checks
    if (!isOwner && !isDriver) {
      throw new Error("Not authorized to update this order");
    }

    // --- Authorization Logic ---

    // Priority Case: A driver (who might also be the owner) is marking an order as delivered.
    if (isDriver && args.status === 'delivered') {
      // A driver can ONLY mark an order as 'delivered', and only if they are assigned to it.
      if (order.driverId !== user._id) {
        throw new ConvexError("You are not assigned to this order.");
      }
    // Case 2: The user is the store owner performing other actions.
    } else if (isOwner) {
      // The owner can confirm, prepare, or dispatch an order.
      // They CANNOT mark it as delivered (this is handled by the priority case above).
      if (args.status === 'delivered') {
        throw new ConvexError("Only the assigned driver can mark the order as delivered.");
      }
      // A driver must be assigned when dispatching.
      if (args.status === 'out_for_delivery' && !args.driverId) {
        throw new ConvexError("A driver must be assigned to dispatch the order.");
      }
    // Case 3: A user is a driver but is trying to do something other than deliver.
    } else if (isDriver) {
      throw new ConvexError("As a driver, you can only mark an order as delivered.");
    }

    console.log(`Updating status of order ${args.orderId} to ${args.status} by user ${user.name}`);

    const updatePayload: Partial<Doc<"orders">> = { status: args.status };
    if (args.status === "out_for_delivery" && args.driverId) updatePayload.driverId = args.driverId;
    if (args.status === "delivered") updatePayload.actualDeliveryTime = Date.now();

    await ctx.db.patch(args.orderId, updatePayload);

    // If the order is delivered, archive the associated conversation
    if (args.status === "delivered") {
      const conversation = await ctx.db.query("conversations").withIndex("by_order", q => q.eq("orderId", args.orderId)).first();
      if (conversation) {
        await ctx.db.patch(conversation._id, {
          isArchived: true,
        });
      }

      // --- ESCROW LOGIC: SCHEDULE AUTO-RELEASE ---
      // Instead of releasing immediately, we schedule it for 48 hours later.
      const commissionRateString = process.env.APP_COMMISSION_RATE || '0.05';
      const appCommissionRate = parseFloat(commissionRateString);
      const payoutAmount = order.totalAmount * (1 - appCommissionRate);

      // Schedule payout for 48 hours from now
      const jobId = await ctx.scheduler.runAfter(48 * 60 * 60 * 1000, internal.paymentsActions.payoutToStore, {
        storeId: order.storeId,
        amount: payoutAmount,
        orderId: args.orderId,
      });
      await ctx.db.patch(args.orderId, { scheduledPayoutId: jobId });
    }

    return { success: true };
  },
});

/**
 * Creates an order in the database after a successful payment.
 * This is an internal mutation, designed to be called from other backend functions.
 */
export const createOrderFromPayment = internalMutation({
  args: {
    userId: v.id("users"), // The user's actual _id
    paymentAmount: v.number(),
    paymentMetadata: v.any(),
    piPaymentId: v.string(),

    paymentRecordId: v.optional(v.id("piPayments")),
  },
  handler: async (ctx, { userId, paymentAmount, paymentMetadata, piPaymentId, paymentRecordId }) => {
    const storeId = paymentMetadata.storeId as Id<"stores">;
    const store = await ctx.db.get(storeId);

    // --- INVENTORY DECREMENT LOGIC ---
    // Only run this for non-restaurant stores
    if (store && store.storeType !== 'restaurant') {
      for (const item of paymentMetadata.items as any[]) {
        const product = await ctx.db.get(item.id as Id<"products">);
        if (!product) {
          throw new ConvexError(`Product with ID ${item.id} not found during stock update.`);
        }

        // Case 1: Product has options, and options were selected in the cart
        if (product.options && product.options.length > 0 && item.options && Object.keys(item.options).length > 0) {
          const newOptions = [...product.options];
          let optionsUpdated = false;

          for (const optionTitle in item.options) {
            const selectedChoices = Array.isArray(item.options[optionTitle]) ? item.options[optionTitle] : [item.options[optionTitle]];
            const optionIndex = newOptions.findIndex(o => o.title === optionTitle);

            if (optionIndex !== -1) {
              for (const selectedChoiceName of selectedChoices) {
                const choiceIndex = newOptions[optionIndex].choices.findIndex(c => c.name === selectedChoiceName);
                if (choiceIndex !== -1) {
                  const choice = newOptions[optionIndex].choices[choiceIndex];
                  if (choice.quantity === undefined || choice.quantity < item.quantity) {
                    throw new ConvexError(`Not enough stock for ${product.name} - ${choice.name}.`);
                  }
                  choice.quantity -= item.quantity;
                  optionsUpdated = true;
                }
              }
            }
          }
          if (optionsUpdated) {
            await ctx.db.patch(product._id, { options: newOptions });
          }
        } else {
          // Case 2: Product has no options, decrement top-level quantity
          if (product.quantity === undefined || product.quantity < item.quantity) {
            throw new ConvexError(`Not enough stock for ${product.name}.`);
          }
          await ctx.db.patch(product._id, { quantity: product.quantity - item.quantity });
        }
      }
    }
    // --- END OF INVENTORY LOGIC ---

    if (!paymentMetadata?.items && !paymentMetadata?.cartItems && !paymentMetadata?.productId) {
      console.warn("No items in payment metadata to create an order from.");
      return null;
    }

    let itemsWithDetails: Array<{
      productId: Id<"products">;
      name: string;

    description: string, // Inclue  description
      quantity: number;
      price: number;
      options?: any;
      imageUrl?: string;
      specialInstructions?: string;
    }> = [];

    if (paymentMetadata.items) {
      // Process items from cart
      itemsWithDetails = await Promise.all(
        (paymentMetadata.items as any[]).map(async (item: any) => {

          const product = await ctx.db.get(item.id as Id<"products">);
          return {
            productId: product?._id || item.id,
            description: product?.description || "",
            name: product?.name || "Unknown Item",
            quantity: item.quantity,
            price: item.price,
            options: item.options || {},
            imageUrl: item.imageUrl || product?.image || "",
            specialInstructions: item.specialInstructions || "",
          };
        })
      );
    } else if (paymentMetadata.productId) {
      // Single product order
      const product = await ctx.db.get(paymentMetadata.productId as Id<"products">);
      itemsWithDetails = [{
        productId: paymentMetadata.productId,
        name: paymentMetadata.productName || product?.name || "Unknown Product",
        description: product?.description || "",
        quantity: 1,
        price: paymentAmount,
        options: {},
        imageUrl: product?.image || "",
        specialInstructions: "",
      }];
    }

    // const store = await ctx.db.get(storeId as Id<"stores">); // Already fetched above

    const orderId = await ctx.db.insert("orders", {
      userId: userId,
      storeId: storeId,
      storeName: store?.name || "OmniGo",
      items: itemsWithDetails,
      totalAmount: paymentAmount,
      discountId: paymentMetadata.discount?.id,
      discountAmount: paymentMetadata.discount?.amount,
      deliveryFee: paymentMetadata.deliveryFee || 0,
      status: "confirmed",
      deliveryAddress: paymentMetadata.deliveryAddress || "",
      customerNotes: paymentMetadata.customerNotes || "",
      estimatedDeliveryTime: "30-45 min",      paymentMethod: "pi_coin",
      customerName: paymentMetadata.customerName,   // Customer anme 
      paymentStatus: "paid",
      piPaymentId: piPaymentId,
      paymentRecordId: paymentRecordId,
    });

    // Increment discount usage count if a discount was applied
    if (paymentMetadata.discount?.code) {
      // Now we call the mutation to apply the discount, which also handles usage counts.
      const user = await ctx.db.get(userId);
      // This ensures the discount is only "used" after a successful order creation.
      await ctx.runMutation(internal.marketing.applyDiscountToOrder, {
        code: paymentMetadata.discount.code,
        userId: userId,
        orderTotal: paymentAmount, // Or subtotal, depending on your logic
        storeId: storeId,
        tokenIdentifier: user?.tokenIdentifier, // We need to pass this for validation
        orderId: orderId,
      });
    }

    // Create a notification for the store owner if it's a valid user ID
    if (store?.ownerId && typeof store.ownerId === 'string') {
      const owner = await ctx.db
        .query("users")
        .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", store.ownerId))
        .unique();
      if (owner) {
        await ctx.db.insert("notifications", {
          userId: owner._id, // Use the actual user _id
          orderId: orderId,
          message: `New order #${orderId.slice(-6)} received for ${store.name}.`,
          isRead: false,
          type: "new_order",
        });
      }
    }

    return orderId;
  },
});

export const confirmOrderReceipt = mutation({
  args: {
    tokenIdentifier: v.string(),
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    const order = await ctx.db.get(args.orderId);

    if (!order || order.userId !== user._id) {
      throw new ConvexError("Order not found or unauthorized.");
    }

    if (order.status !== 'delivered') {
      throw new ConvexError("Order must be marked as delivered first.");
    }

    // Cancel the scheduled 48h payout if it exists
    if (order.scheduledPayoutId) {
      await ctx.scheduler.cancel(order.scheduledPayoutId);
    }

    // Release funds immediately
    const commissionRateString = process.env.APP_COMMISSION_RATE || '0.05';
    const appCommissionRate = parseFloat(commissionRateString);
    const payoutAmount = order.totalAmount * (1 - appCommissionRate);

    await ctx.scheduler.runAfter(0, internal.paymentsActions.payoutToStore, {
      storeId: order.storeId,
      amount: payoutAmount,
      orderId: args.orderId,
    });

    // We could add a 'completed' status here if desired, but 'delivered' + payout implies completion.
    // For now, we just ensure the payout happens now.
    await ctx.db.patch(args.orderId, { 
      scheduledPayoutId: undefined,
      paymentStatus: "released"
    }); // Clear the job ID and update payment status

    return { success: true };
  },
});

export const createDispute = mutation({
  args: {
    tokenIdentifier: v.string(),
    orderId: v.id("orders"),
    reason: v.string(),
    description: v.string(),
    imageIds: v.optional(v.array(v.id("_storage"))),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    const order = await ctx.db.get(args.orderId);

    if (!order || order.userId !== user._id) {
      throw new ConvexError("Order not found or unauthorized.");
    }

    if (order.status !== 'delivered') {
      throw new ConvexError("You can only report issues after the order is marked delivered.");
    }

    // 1. Cancel the auto-release payout
    if (order.scheduledPayoutId) {
      await ctx.scheduler.cancel(order.scheduledPayoutId);
    }

    // 2. Update order status to DISPUTED
    await ctx.db.patch(args.orderId, { status: 'disputed', scheduledPayoutId: undefined });

    // 3. Create the report record
    await ctx.db.insert("reports", {
      orderId: args.orderId,
      userId: user._id,
      storeId: order.storeId,
      reason: args.reason,
      description: args.description,
      imageIds: args.imageIds,
      status: 'open',
    });

    return { success: true };
  },
});