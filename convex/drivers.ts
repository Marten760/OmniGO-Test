import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { validateToken } from "./util";
import { ConvexError } from "convex/values";

/**
 * Allows a user to apply to be a driver for a specific store.
 */
export const applyToBeDriver = mutation({
  args: {
    tokenIdentifier: v.string(),
    storeId: v.id("stores"),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);

    // Check if an application already exists
    const existingApplication = await ctx.db
      .query("storeDrivers")
      .withIndex("by_store_and_driver", (q) =>
        q.eq("storeId", args.storeId).eq("driverId", user._id)
      )
      .first();

    if (existingApplication) {
      throw new ConvexError(`You have already applied to this store. Status: ${existingApplication.status}`);
    }

    await ctx.db.insert("storeDrivers", {
      storeId: args.storeId,
      driverId: user._id,
      status: "pending",
    });

    // Notify store owner
    const store = await ctx.db.get(args.storeId);
    if (store && store.ownerId) {
      const owner = await ctx.db
        .query("users")
        .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", store.ownerId))
        .unique();
      
      if (owner) {
        await ctx.db.insert("notifications", {
          userId: owner._id,
          storeId: args.storeId,
          message: `New driver application from ${user.name || "a user"}.`,
          isRead: false,
          type: "driver_application",
        });
      }
    }

    return { success: true };
  },
});

/**
 * Fetches all drivers (pending, active, inactive) for a specific store.
 * Only the store owner can access this.
 */
export const getDriversForStore = query({
  args: {
    tokenIdentifier: v.string(),
    storeId: v.id("stores"),
  },
  handler: async (ctx, args) => {
    const owner = await validateToken(ctx, args.tokenIdentifier);
    const store = await ctx.db.get(args.storeId);

    if (!store || store.ownerId !== owner.tokenIdentifier) {
      throw new ConvexError("You are not authorized to view drivers for this store.");
    }

    const driverLinks = await ctx.db
      .query("storeDrivers")
      .withIndex("by_store", (q) => q.eq("storeId", args.storeId))
      .collect();

    const driversWithProfiles = await Promise.all(
      driverLinks.map(async (link) => {
        const [driverProfile, driverUser] = await Promise.all([
          ctx.db.query("userProfiles").withIndex("by_user", q => q.eq("userId", link.driverId)).unique(),
          ctx.db.get(link.driverId)
        ]);
        const profileImageUrl = driverProfile?.profileImageId 
          ? await ctx.storage.getUrl(driverProfile.profileImageId) 
          : null;
        return {
          ...link,
          profile: driverProfile ? { ...driverProfile, profileImageUrl } : null,
          name: driverUser?.name ?? "Unknown Driver",
        };
      })
    );

    return driversWithProfiles;
  },
});

/**
 * Allows a store owner to manage a driver's status (approve, reject, deactivate, reactivate).
 */
export const manageDriverStatus = mutation({
  args: {
    tokenIdentifier: v.string(),
    driverLinkId: v.id("storeDrivers"),
    action: v.union(
      v.literal("approve"),
      v.literal("reject"),
      v.literal("deactivate"),
      v.literal("reactivate"),
      v.literal("fire") // Add "fire" action
    ),
  },
  handler: async (ctx, args) => {
    const owner = await validateToken(ctx, args.tokenIdentifier);
    const driverLink = await ctx.db.get(args.driverLinkId);

    if (!driverLink) throw new ConvexError("Driver application not found.");

    const store = await ctx.db.get(driverLink.storeId);
    if (!store || store.ownerId !== owner.tokenIdentifier) {
      throw new ConvexError("You are not authorized to manage drivers for this store.");
    }

    switch (args.action) {
      case "approve":
        await ctx.db.patch(driverLink._id, { status: "active" });
        const profile = await ctx.db.query("userProfiles").withIndex("by_user", q => q.eq("userId", driverLink.driverId)).unique();
        if (profile) {
          const roles = new Set(profile.roles || []);
          roles.add("driver");
          await ctx.db.patch(profile._id, { roles: Array.from(roles) });
        }
        break;
      case "reject":
        await ctx.db.delete(driverLink._id);
        break;
      case "fire":
        // Deleting the link permanently removes the driver from the store.
        await ctx.db.delete(driverLink._id);

        // Optional: Check if the user is a driver for any other store.
        // If not, remove their "driver" role entirely.
        const otherActiveLinks = await ctx.db.query("storeDrivers")
          .withIndex("by_driver", q => q.eq("driverId", driverLink.driverId))
          .filter(q => q.eq(q.field("status"), "active"))
          .collect();
        
        if (otherActiveLinks.length === 0) {
          const profile = await ctx.db.query("userProfiles").withIndex("by_user", q => q.eq("userId", driverLink.driverId)).unique();
          if (profile) await ctx.db.patch(profile._id, { roles: profile.roles?.filter(r => r !== 'driver') });
        }
        break;
      case "deactivate":
        await ctx.db.patch(driverLink._id, { status: "inactive" });
        break;
      case "reactivate":
        await ctx.db.patch(driverLink._id, { status: "active" });
        break;
    }
    return { success: true };
  },
});