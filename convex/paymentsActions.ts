"use node"; // Required for Pi-Backend and Node.js APIs

import { action, internalAction, ActionCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { api, internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";

// [ملاحظة]: تم إزالة StellarSdk لأنه لم يعد ضرورياً للدفع.
// الطريقة الجديدة تستخدم Pi Payments API مباشرة.

// الرابط الثابت لكل خدمات Platform API (approve, complete, create payment, /v2/me, ...)
const getPiPlatformApiBase = () => {
  // FIX: Always use api.minepi.com for Platform API calls (/v2/payments, /v2/me).
  // api.testnet.minepi.com is the Horizon (Blockchain) API, which doesn't support these endpoints.
  // The environment (Sandbox/Production) is determined by the API Key, not the URL.
  return "https://api.minepi.com";
};

/**
 * Verifies Pi Network webhook signature for security.
 * This is an internal action to keep the webhook secret secure.
 */
export const verifyPiWebhook = internalAction({
  args: {
    headers: v.object({
      x_pi_signature: v.optional(v.string( )),
    }),
    rawBody: v.string(),
  },
  handler: async (ctx, { headers, rawBody }) => {
    const signature = headers.x_pi_signature;
    
    if (!signature) {
      return { isValid: false, body: rawBody };
    }
    
    const webhookSecret = process.env.PI_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.warn("PI_WEBHOOK_SECRET not configured. Allowing webhook for development.");
      return { isValid: true, body: rawBody };
    }
    
    try {
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');
      
      const providedSignature = signature.replace('sha256=', '');
      const isValid = crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(providedSignature, 'hex')
      );
      
      return { isValid, body: rawBody };
    } catch (error) {
      console.error("Webhook signature verification failed:", error);
      return { isValid: false, body: rawBody };
    }
  },
});

/**
 * Action to verify if the PI_API_KEY is valid and can connect to Pi Platform API.
 */
export const verifyPiApiKey = action({
  args: {},
  handler: async () => {
    const apiKey = process.env.PI_API_KEY;
    if (!apiKey) {
      return { success: false, message: "PI_API_KEY is missing in environment variables." };
    }

    // Attempt to validate the key by hitting the create payment endpoint with invalid data.
    // Valid Key -> 400 Bad Request (Missing parameters)
    // Invalid Key -> 401 Unauthorized
    try {
      const response = await fetch(`${getPiPlatformApiBase()}/v2/payments`, {
        method: 'POST',
        headers: { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}) // Empty body to trigger validation error
      });

      if (response.status === 400) {
        return { success: true, message: "API Key is valid (Connected to Pi Platform API)." };
      } else {
        return { success: false, message: `API Key validation failed. Status: ${response.status}.` };
      }
    } catch (error: any) {
      return { success: false, message: `Connection error: ${error.message}` };
    }
  },
});

/**
 * Approves a payment on the Pi Network from the server-side.
 */
export const approvePiPayment = action({
  args: {
    tokenIdentifier: v.string(),
    paymentId: v.string(),
    accessToken: v.string(),
    amount: v.optional(v.number()),
    memo: v.optional(v.string()),
    metadata: v.any(),
  },
  handler: async (ctx, { tokenIdentifier, paymentId, accessToken, amount, memo, metadata}) => {
    const user = await ctx.runQuery(internal.users.getUser, { tokenIdentifier });
    if (!user) throw new Error("User must be authenticated to approve a payment.");

    if (!amount || amount <= 0) {
      throw new Error("Invalid payment amount. Amount must be greater than 0.");
    }

    const useSandbox = process.env.PI_SANDBOX === 'true';
    const baseUrl = getPiPlatformApiBase();
    const piApiUrl = `${baseUrl}/v2/me`;

    console.log(`[approvePiPayment] Network: ${useSandbox ? 'Testnet' : 'Mainnet'}, URL: ${piApiUrl}`);
    console.log(`[approvePiPayment] Access Token preview: ${accessToken.slice(0, 10)}... (length: ${accessToken.length})`);
    
    let piApiUser;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(piApiUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
    
        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`Pi API /me check failed with status ${response.status}: ${errorBody}`);
        }
        piApiUser = await response.json();
        break;
      } catch (error) {
        if (error instanceof Error && error.message.includes('unsuccessful tunnel')) {
          console.warn(`[Payments] Tunnel connection issue detected on attempt ${attempt}. This is common in dev mode. Deploying to production usually resolves this.`);
        }
        console.error(`Attempt ${attempt} to verify access token failed:`, error);
        if (attempt === 3) throw new Error("Pi payment approval failed: Could not verify access token with Pi servers.");
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
      }
    }

    const userProfile = await ctx.runQuery(internal.users.getProfile, { userId: user._id });
    if (!userProfile) {
      throw new Error("User profile not found for payment approval.");
    }
    if (piApiUser.uid !== userProfile.piUid) {
      throw new Error("Pi user ID mismatch during payment approval.");
    }

    // --- Inventory Check ---
    const itemsToCheck: any[] = [];
    if (metadata.items) {
      itemsToCheck.push(...metadata.items.map((item: any) => ({
        productId: item.id,
        quantity: item.quantity,
        options: item.options
      })));
    } else if (metadata.productId) {
      itemsToCheck.push({
        productId: metadata.productId,
        quantity: 1,
        options: metadata.options
      });
    }

    if (itemsToCheck.length > 0) {
      await ctx.runQuery(internal.inventory.checkInventoryAvailability, {
        items: itemsToCheck
      });
    }
    
    // --- Delivery Zone Validation ---
    if (metadata && metadata.storeId) {
      const store = await ctx.runQuery(internal.stores.getStoreForPayout, { storeId: metadata.storeId });
      
      if (store) {
        const userCountry = metadata.deliveryCountry || userProfile.country;
        const userCity = metadata.deliveryCity || userProfile.city;

        if (!userCountry || !userCity) {
          throw new Error("Please update your account with your Country and City to proceed with the order.");
        }

        if (store.country !== userCountry) {
           throw new Error(`This store only delivers within ${store.country}.`);
        }

        if (store.deliveryRegions && store.deliveryRegions.length > 0) {
          const isAllowed = store.isDeliveryRegionsAllowList ?? true;
          const inList = store.deliveryRegions.includes(userCity);

          if (isAllowed) {
            if (!inList) throw new Error(`This store does not deliver to ${userCity}.`);
          } else {
            if (inList) throw new Error(`This store does not deliver to ${userCity}.`);
          }
        }
      }
    }

    await ctx.runMutation(internal.paymentsQueries.createPaymentRecord, {
      paymentId,
      userId: user._id,
      amount: amount ?? 0,
      memo: memo ?? "",
      metadata,
      status: "approved",
    });

    const piApiKey = process.env.PI_API_KEY;
    if (!piApiKey) {
      console.warn("PI_API_KEY environment variable not set. Using mock approval for development.");
      return { success: true, mock: true };
    }

    try {
      const approveResponse = await fetch(`${baseUrl}/v2/payments/${paymentId}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Key ${piApiKey}` },
      });

      const responseBody = await approveResponse.json();

      if (!approveResponse.ok) {
        // FIX: Handle "already_approved" error gracefully.
        // If the payment is already approved, we should proceed as success.
        if (responseBody.error === "already_approved" && responseBody.payment) {
          console.log(`[approvePiPayment] Payment ${paymentId} was already approved. Proceeding.`);
          return responseBody.payment;
        }
        throw new Error(`Failed to approve Pi payment: ${JSON.stringify(responseBody)}`);
      }

      return responseBody;
    } catch (error) {
      console.error("Pi payment approval failed:", error);
      throw error;
    }
  },
});

/**
 * [معدلة] Internal action to transfer funds from the app wallet to a user.
 * تستخدم الآن Pi Payments API الرسمي. هذه الدالة يمكن استخدامها لكل من المبالغ المستردة والمدفوعات.
 */
export const refundToCustomer = internalAction({
  args: {
    userId: v.id("users"),
    storeId: v.id("stores"),
    amount: v.number(),
    orderId: v.id("orders"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; reason?: string; txid?: string; }> => {
    const startResult = await ctx.runMutation(internal.paymentsQueries.startPayout, {
      storeId: args.storeId,
      orderId: args.orderId,
      amount: args.amount,
    });

    if (startResult.status === "already_completed") {
      console.log(`[refundToCustomer] Refund for order ${args.orderId} already completed.`);
      return { success: true, txid: startResult.txid };
    }
    if (startResult.status === "in_progress") {
      console.warn(`[refundToCustomer] Refund for order ${args.orderId} is already in progress.`);
      return { success: false, reason: "Refund is currently in progress. Please wait." };
    }
    const payoutId = startResult.payoutId!;

    const profile = await ctx.runQuery(internal.users.getProfile, { userId: args.userId });
    if (!profile || !profile.piUid) {
      const errorMsg = `Customer (ID: ${args.userId}) has no Pi UID linked. Cannot refund automatically.`;
      await ctx.runMutation(internal.paymentsQueries.finalizePayout, { payoutId, status: "failed", failureReason: errorMsg });
      return { success: false, reason: errorMsg };
    }
    const recipientPiUid = profile.piUid;

    console.log(`[refundToCustomer] Processing refund of ${args.amount} Pi to UID: ${recipientPiUid} (Order: ${args.orderId})`);

    const piApiKey = process.env.PI_API_KEY;
    if (!piApiKey) {
      const errorMsg = "Missing PI_API_KEY environment variable.";
      await ctx.runMutation(internal.paymentsQueries.finalizePayout, { payoutId, status: "failed", failureReason: errorMsg });
      return { success: false, reason: errorMsg };
    }

    const safeAmount = (Math.round(args.amount * 10000000) / 10000000).toFixed(7);
    const paymentMemo = `Refund for order ${args.orderId}`;
    const paymentIdempotencyKey = `refund-${args.orderId}`;

    try {
      const response = await fetch(`${getPiPlatformApiBase()}/v2/payments`, {
        method: 'POST',
        headers: { 'Authorization': `Key ${piApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment: {
            amount: parseFloat(safeAmount),
            memo: paymentMemo,
            recipient: recipientPiUid,
            from_app_to_user: true,
          },
          idem: paymentIdempotencyKey,
        }),
      });

      const responseBody = await response.json();
      if (!response.ok) {
        console.error(`[refundToCustomer] Pi API Error Details:`, responseBody);
        throw new Error(`Pi API Error: ${responseBody.message || responseBody.error || JSON.stringify(responseBody)}`);
      }
      
      const paymentId = responseBody.identifier;
      console.log(`[refundToCustomer] Refund payment created with ID: ${paymentId}.`);

      await ctx.runMutation(internal.paymentsQueries.finalizePayout, {
        payoutId,
        txid: paymentId,
        status: "completed"
      });

      return { success: true, txid: paymentId };

    } catch (error: any) {
      console.error(`[refundToCustomer] Failed:`, error.message);
      await ctx.runMutation(internal.paymentsQueries.finalizePayout, { payoutId, status: "failed", failureReason: error.message });
      return { success: false, reason: error.message };
    }
  },
});

/**
 * Completes the payment on the Pi Network from the server-side.
 */
export const completePiPayment = action({
  args: {
    paymentId: v.string(),
    txid: v.optional(v.string()),
  },
  handler: async (ctx, { paymentId, txid }): Promise<{ success: boolean; message: string; payment?: any, txid?: string | null }> => {
    const existingPayment: { status?: string } | null = await ctx.runQuery(api.paymentsQueries.getPaymentById, {
      paymentId,
    });
    if (existingPayment?.status === 'completed') {
      console.log(`[completePiPayment] Payment ${paymentId} is already completed in DB. Skipping.`);
      return {
        success: true,
        message: "Payment was already completed.",
        payment: existingPayment,
        txid: (existingPayment as any)?.txid
      };
    }

    const baseUrl = getPiPlatformApiBase();
    const piApiKey = process.env.PI_API_KEY;
    if (!piApiKey) {
      console.warn("PI_API_KEY not set. Mocking completion.");
      await ctx.runMutation(internal.paymentsQueries.updatePaymentStatus, { paymentId, status: 'completed', txid: txid || 'mock-txid' });
      await ctx.runMutation(internal.paymentsQueries.processCompletedPayment, { paymentId, payment: null });
      return { success: true, message: 'Mock completion successful' };
    }

    try {
      const completeResponse = await fetch(`${baseUrl}/v2/payments/${paymentId}/complete`, {
        method: 'POST',
        headers: { 'Authorization': `Key ${piApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ txid }),
      });

      if (!completeResponse.ok) {
        const errorBody = await completeResponse.text();
        throw new Error(`Pi complete API failed: ${completeResponse.status} - ${errorBody}`);
      }
      console.log(`[completePiPayment] Successfully called /complete for ${paymentId}`);
    } catch (completeError: any) {
      console.error(`[completePiPayment] /complete API error for ${paymentId}:`, completeError.message);
      await ctx.runMutation(internal.paymentsQueries.updatePaymentStatus, {
        paymentId,
        status: 'failed',
        failureReason: `Complete API: ${completeError.message}`,
      });
      return { success: false, message: completeError.message };
    }

    try {
      const paymentResponse = await fetch(`${baseUrl}/v2/payments/${paymentId}`, {
        headers: { Authorization: `Key ${piApiKey}` },
      });
      if (!paymentResponse.ok) {
        throw new Error(`Failed to fetch payment details: ${paymentResponse.status}`);
      }
      const payment = await paymentResponse.json();

      await ctx.runMutation(internal.paymentsQueries.updatePaymentStatus, {
        paymentId,
        status: 'completed',
        txid: txid || payment.transaction?.txid,
      });

      try {
        await ctx.runMutation(internal.paymentsQueries.processCompletedPayment, {
          paymentId,
          payment: { ...payment, txid: txid || payment.transaction?.txid },
        });
      } catch (orderError: any) {
        console.error(`CRITICAL: Order creation failed for COMPLETED payment ${paymentId}:`, orderError);
        await ctx.runMutation(internal.paymentsQueries.updatePaymentStatus, {
          paymentId,
          status: 'completed', 
          failureReason: `Order creation failed: ${orderError.message}`
        });
      }

      return { success: true, message: 'Payment completed successfully', payment, txid: txid || payment.transaction?.txid };
    } catch (error: any) {
      console.error(`[completePiPayment] Post-complete error for payment ${paymentId}:`, error);
      await ctx.runMutation(internal.paymentsQueries.updatePaymentStatus, {
        paymentId,
        status: 'failed',
        failureReason: error.message,
      });
      return { success: false, message: error.message };
    }
  },
});

/**
 * Public action to allow the client to report a cancelled or abandoned payment.
 */
export const reportCancelledPayment = action({
  args: {
    paymentId: v.string(),
  },
  handler: async (ctx, { paymentId }) => {
    await ctx.runMutation(internal.paymentsQueries.updatePaymentStatus, {
      paymentId,
      status: "cancelled",
    });
  },
});

/**
 * Public action to allow a store owner to retry a failed payout.
 */
export const retryFailedPayout = action({
  args: {
    tokenIdentifier: v.string(),
    storeId: v.id("stores"),
    orderId: v.id("orders"),
    amount: v.number(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; reason?: string; txid?: any; }> => {
    const user = await ctx.runQuery(api.auth.getUserFromToken, { tokenIdentifier: args.tokenIdentifier });
    const store = await ctx.runQuery(internal.stores.getStoreForPayout, { storeId: args.storeId });

    if (!user || !store || store.ownerId !== user.tokenIdentifier) {
      throw new ConvexError("You are not authorized to retry this payout.");
    }

    return await ctx.runAction(internal.paymentsActions.payoutToStore, {
      storeId: args.storeId,
      amount: args.amount,
      orderId: args.orderId,
    });
  },
});

/**
 * [معدلة] Internal action to transfer funds from the app wallet to the store owner's wallet.
 * تستخدم الآن Pi Payments API الرسمي بدلاً من Stellar SDK المباشر.
 */
export const payoutToStore = internalAction({
  args: {
    storeId: v.id("stores"),
    amount: v.number(),
    orderId: v.id("orders"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; reason?: string; txid?: string; willRetry?: boolean; }> => {
    const startResult = await ctx.runMutation(internal.paymentsQueries.startPayout, {
      storeId: args.storeId,
      orderId: args.orderId,
      amount: args.amount,
    });

    if (startResult.status === "already_completed") {
      console.log(`[payoutToStore] Payout for order ${args.orderId} already completed.`);
      return { success: true, txid: startResult.txid };
    }
    if (startResult.status === "in_progress") {
      console.warn(`[payoutToStore] Payout for order ${args.orderId} is already in progress.`);
      return { success: false, reason: "Payout is currently in progress. Please wait." };
    }
    const payoutId = startResult.payoutId!;

    const store = await ctx.runQuery(internal.stores.getStoreForPayout, { storeId: args.storeId });
    if (!store) {
      const errorMsg = `Store ${args.storeId} not found.`;
      await ctx.runMutation(internal.paymentsQueries.finalizePayout, { payoutId, status: "failed", failureReason: errorMsg });
      return { success: false, reason: errorMsg };
    }
    
    // [تعديل]: نحتاج إلى Pi UID الخاص بالمالك لإجراء الدفع
    const user = await ctx.runQuery(internal.users.getUser, { tokenIdentifier: store.ownerId });
    const profile = await ctx.runQuery(internal.users.getProfile, { userId: user._id });

    if (!profile || !profile.piUid) {
        const errorMsg = `Store owner for ${args.storeId} has no Pi UID. Cannot process A2U payment.`;
        await ctx.runMutation(internal.paymentsQueries.finalizePayout, { payoutId, status: "failed", failureReason: errorMsg });
        return { success: false, reason: errorMsg };
    }
    const recipientPiUid = profile.piUid;

    console.log(`[payoutToStore] Initiating A2U payment to Pi UID: ${recipientPiUid} for order ${args.orderId}.`);

    const piApiKey = process.env.PI_API_KEY;
    if (!piApiKey) {
      const errorMsg = "Missing PI_API_KEY environment variable.";
      await ctx.runMutation(internal.paymentsQueries.finalizePayout, { payoutId, status: "failed", failureReason: errorMsg });
      return { success: false, reason: errorMsg };
    }

    const safeAmount = (Math.round(args.amount * 10000000) / 10000000).toFixed(7);
    const paymentMemo = `Payout for order ${args.orderId}`;
    const paymentIdempotencyKey = `payout-${args.orderId}`;

    const paymentPayload = {
      payment: {
        amount: parseFloat(safeAmount),
        memo: paymentMemo,
        recipient: recipientPiUid,
        from_app_to_user: true,
      },
      idem: paymentIdempotencyKey,
    };
    console.log(`[payoutToStore] Sending Payload:`, JSON.stringify(paymentPayload));

    try {
      const response = await fetch(`${getPiPlatformApiBase()}/v2/payments`, {
        method: 'POST',
        headers: { 'Authorization': `Key ${piApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentPayload),
      });

      const responseBody = await response.json();
      if (!response.ok) {
        console.error(`[payoutToStore] Pi API Error Details:`, responseBody);
        throw new Error(`Pi API Error: ${responseBody.message || responseBody.error || JSON.stringify(responseBody)}`);
      }
      
      const paymentId = responseBody.identifier;
      console.log(`[payoutToStore] A2U payment created with ID: ${paymentId}.`);

      await ctx.runMutation(internal.paymentsQueries.finalizePayout, {
        payoutId,
        txid: paymentId,
        status: "completed"
      });

      return { success: true, txid: paymentId };

    } catch (error: any) {
      console.error(`[payoutToStore] A2U payment failed for order ${args.orderId}:`, error.message);
      await ctx.runMutation(internal.paymentsQueries.finalizePayout, { payoutId, status: "failed", failureReason: error.message });
      return { success: false, reason: error.message };
    }
  },
});

/**
 * [دالة جديدة] لإرسال معاملة A2U بسيطة لغرض الاختبار.
 * يمكنك استدعاء هذه الدالة 10 مرات مع 10 Pi UIDs مختلفة.
 */
export const sendTestA2UTransaction = action({
    args: {
        recipientPiUid: v.string(),
        amount: v.number(),
        memo: v.string(),
    },
    handler: async (ctx, args) => {
        const piApiKey = process.env.PI_API_KEY;
        if (!piApiKey) {
            throw new ConvexError("PI_API_KEY is not configured.");
        }

        console.log(`Sending test A2U tx of ${args.amount} to ${args.recipientPiUid}`);

        const payload = {
            payment: {
                amount: args.amount,
                memo: args.memo,
                recipient: args.recipientPiUid.trim(),
                from_app_to_user: true,
            },
            idem: `test-a2u-${args.recipientPiUid.trim()}-${Date.now()}`,
        };
        console.log("[sendTestA2UTransaction] Payload:", JSON.stringify(payload));

        try {
            const response = await fetch(`${getPiPlatformApiBase()}/v2/payments`, {
                method: 'POST',
                headers: {
                    'Authorization': `Key ${piApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const responseBody = await response.json();

            if (!response.ok) {
                console.error("Pi API Test Transaction Failed. Response Body:", JSON.stringify(responseBody, null, 2));
                const errorMessage = responseBody.error_message || responseBody.message || responseBody.error || JSON.stringify(responseBody);
                throw new ConvexError(`Pi API Error: ${errorMessage}`);
            }

            console.log("Test A2U transaction created successfully:", responseBody);
            return { success: true, data: responseBody };

        } catch (error: any) {
            console.error("Failed to send test A2U transaction:", error);
            throw new ConvexError(error.message);
        }
    }
});

/**
 * Server-side action to handle incomplete payments.
 */
export const handleIncompletePaymentAction = action({
  args: {
    paymentId: v.string(),
  },
  handler: async (ctx, { paymentId }): Promise<{ success: boolean; action?: string; txid?: string; reason?: string; mock?: boolean; }> => {
    const baseUrl = getPiPlatformApiBase();
    const piApiKey = process.env.PI_API_KEY;
    if (!piApiKey) {
      console.warn("PI_API_KEY not set. Mocking incomplete payment handling.");
      await ctx.runMutation(internal.paymentsQueries.updatePaymentStatus, { 
        paymentId, 
        status: 'completed', 
        txid: 'mock-txid' 
      });
      return { success: true, mock: true, action: 'completed' };
    }

    try {
      const paymentResponse = await fetch(`${baseUrl}/v2/payments/${paymentId}`, {
        headers: { Authorization: `Key ${piApiKey}` },
      });
      if (!paymentResponse.ok) {
        throw new Error(`Failed to fetch payment: ${paymentResponse.status}`);
      }
      const payment = await paymentResponse.json();
      console.log(`[handleIncompletePaymentAction] Fetched payment ${paymentId}: direction=${payment.direction}, status=${JSON.stringify(payment.status)}`);

      const txid = payment.transaction?.txid;
      let actionTaken: string;

      if (payment.direction === 'user_to_app' && payment.status.transaction_verified && !payment.status.developer_completed) {
        if (!txid) throw new Error('No transaction ID found for U2A payment. Cannot complete.');
        const completeResponse = await fetch(`${baseUrl}/v2/payments/${paymentId}/complete`, {
          method: 'POST',
          headers: { 'Authorization': `Key ${piApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ txid }),
        });
        if (!completeResponse.ok) throw new Error(`Complete failed: ${await completeResponse.text()}`);
        actionTaken = 'completed';
        console.log(`[handleIncompletePaymentAction] Completed U2A payment ${paymentId}.`);
      } else if (payment.direction === 'app_to_user' && !payment.status.cancelled) {
        const cancelResponse = await fetch(`${baseUrl}/v2/payments/${paymentId}/cancel`, {
          method: 'POST',
          headers: { Authorization: `Key ${piApiKey}` },
        });
        if (!cancelResponse.ok) throw new Error(`Cancel failed: ${await cancelResponse.text()}`);
        actionTaken = 'cancelled';
        console.log(`[handleIncompletePaymentAction] Cancelled A2U payment ${paymentId}.`);
      } else {
        throw new Error(`Cannot handle payment: direction=${payment.direction}, status=${JSON.stringify(payment.status)}`);
      }

      if (actionTaken === 'completed') {
        await ctx.runMutation(internal.paymentsQueries.updatePaymentStatus, { paymentId, status: 'completed', txid });
        await ctx.runMutation(internal.paymentsQueries.processCompletedPayment, { paymentId, payment });
      } else {
        await ctx.runMutation(internal.paymentsQueries.updatePaymentStatus, { paymentId, status: 'cancelled', failureReason: 'Handled as incomplete' });
      }

      return { success: true, action: actionTaken, txid };
    } catch (error: any) {
      console.error(`[handleIncompletePaymentAction] Failed to handle ${paymentId}:`, error.message);
      await ctx.runMutation(internal.paymentsQueries.updatePaymentStatus, { paymentId, status: 'failed', failureReason: error.message });
      return { success: false, reason: error.message };
    }
  },
});
