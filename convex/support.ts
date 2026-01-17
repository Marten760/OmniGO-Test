import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { validateToken } from "./util";

export const createSupportTicket = mutation({
  args: {
    tokenIdentifier: v.string(),
    subject: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);

    if (args.subject.length < 5) {
      throw new Error("Subject must be at least 5 characters long.");
    }
    if (args.message.length < 20) {
      throw new Error("Message must be at least 20 characters long.");
    }

    await ctx.db.insert("supportTickets", {
      userId: user._id,
      userName: user.name,
      userEmail: user.email,
      subject: args.subject,
      message: args.message,
      status: "open",
    });

    return { success: true };
  },
});