import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { api } from "./_generated/api";

const http = httpRouter();

// Pi Network payment webhook
http.route({
  path: "/pi/payments",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    let paymentId: string | undefined;
    try {
      // The signature verification is a critical security step.
      // We will use an internal action to perform the verification.
      // This keeps the webhook secret from being exposed in the request logs.
      const { isValid, body: rawBody } = await ctx.runAction(internal.paymentsActions.verifyPiWebhook, {
        headers: {
          x_pi_signature: request.headers.get("x-pi-signature") ?? undefined,
        },
        rawBody: await request.text(),
      });
      
      if (!isValid) {
        console.error("Pi Webhook Error: Invalid signature.");
        return new Response("Unauthorized: Invalid signature", { status: 401 });
      }
      const body = JSON.parse(rawBody);
      console.log("Pi Webhook: Received and verified. Body:", body);

      paymentId = body.paymentId;
      const txid = body.txid;

      if (!paymentId) {
        console.error("Pi Webhook Error: paymentId is missing in the webhook body.");
        return new Response("Bad Request: paymentId is missing.", { status: 400 });
      }
      
      // Idempotency Check: Prevent processing the same webhook multiple times.
      const existingPayment = await ctx.runQuery(api.paymentsQueries.getPaymentById, { paymentId });
      if (existingPayment?.status === 'completed') {
        console.log(`Webhook: Payment ${paymentId} already completed. Ignoring duplicate.`);
        return new Response('OK (Already Processed)', { status: 200 });
      }

      // Use the unified updatePaymentStatus mutation to handle webhook events
      await ctx.runMutation(internal.paymentsQueries.updatePaymentStatus, {
        status: "completed", // Webhook only fires on completion
        paymentId,
        txid,
      });
      
      // NEW: Fetch payment details from Pi API to pass to the processing function.
      // This ensures the order is created even if the client-side callback fails.
      const baseUrl = "https://api.minepi.com";
      const piApiKey = process.env.PI_API_KEY;

      if (piApiKey) {
        const paymentResponse = await fetch(`${baseUrl}/v2/payments/${paymentId}`, { headers: { Authorization: `Key ${piApiKey}` } });
        if (paymentResponse.ok) {
          const payment = await paymentResponse.json();
          await ctx.runMutation(internal.paymentsQueries.processCompletedPayment, { paymentId, payment: { ...payment, txid } });
          console.log(`Webhook: Processed completion for payment ${paymentId}. Order created if needed.`);
        } else {
          console.error(`Webhook: Failed to fetch payment details for ${paymentId}: ${paymentResponse.status}`);
        }
      }

      return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (error) {
      console.error(`Pi Webhook Error: Failed to process webhook for paymentId: ${paymentId}. Error:`, error);
      return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
    }
  }),
});

export default http;