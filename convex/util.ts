import { ConvexError } from "convex/values";
import { QueryCtx, MutationCtx } from "./_generated/server";
import { Doc } from "./_generated/dataModel";

/**
 * دالة مساعدة للتحقق من التوكن وإرجاع المستخدم.
 * @throws ConvexError if user is not found.
 */
export async function validateToken(ctx: QueryCtx | MutationCtx, tokenIdentifier: string): Promise<Doc<"users">> {
  const user = await ctx.db.query("users")
    .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
    .unique();
  if (!user) throw new ConvexError("Invalid or expired token. Please sign in again.");
  return user;
}