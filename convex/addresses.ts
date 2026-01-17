import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { validateToken } from "./util";
import { Doc, Id } from "./_generated/dataModel";

export const getUserAddresses = query({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    const addresses = await ctx.db
      .query("userAddresses")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    
    const profile = await ctx.db.query("userProfiles").withIndex("by_user", q => q.eq("userId", user._id)).unique();

    return {
      addresses,
      defaultAddressId: profile?.defaultAddress,
    };
  },
});

const addressArgs = {
  label: v.string(),
  address: v.string(),
  city: v.string(),
  country: v.string(),
  postalCode: v.optional(v.string()),
  latitude: v.optional(v.number()),
  longitude: v.optional(v.number()),
};

export const addAddress = mutation({
  args: {
    tokenIdentifier: v.string(),
    ...addressArgs,
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    const { tokenIdentifier, ...addressData } = args;
    const addressId = await ctx.db.insert("userAddresses", {
      userId: user._id,
      ...addressData,
    });

    // If this is the first address, set it as default and sync to profile
    const addresses = await ctx.db.query("userAddresses").withIndex("by_user", q => q.eq("userId", user._id)).collect();
    if (addresses.length === 1) {
      const profile = await ctx.db.query("userProfiles").withIndex("by_user", q => q.eq("userId", user._id)).unique();
      if (profile) {
        await ctx.db.patch(profile._id, { defaultAddress: addressId, country: addressData.country, city: addressData.city });
      }
    }
  },
});

export const updateAddress = mutation({
  args: {
    tokenIdentifier: v.string(),
    addressId: v.id("userAddresses"),
    ...addressArgs,
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    const { tokenIdentifier, addressId, ...addressData } = args;
    
    const existingAddress = await ctx.db.get(addressId);
    if (!existingAddress || existingAddress.userId !== user._id) {
      throw new Error("Address not found or permission denied.");
    }

    await ctx.db.patch(addressId, addressData);

    // If this is the default address, sync changes to profile
    const profile = await ctx.db.query("userProfiles").withIndex("by_user", q => q.eq("userId", user._id)).unique();
    if (profile && profile.defaultAddress === addressId) {
      await ctx.db.patch(profile._id, { country: addressData.country, city: addressData.city });
    }
  },
});

export const deleteAddress = mutation({
  args: {
    tokenIdentifier: v.string(),
    addressId: v.id("userAddresses"),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    const existingAddress = await ctx.db.get(args.addressId);
    if (!existingAddress || existingAddress.userId !== user._id) {
      throw new Error("Address not found or permission denied.");
    }

    // Check if this was the default address and update profile if so
    const profile = await ctx.db.query("userProfiles").withIndex("by_user", q => q.eq("userId", user._id)).unique();
    if (profile && profile.defaultAddress === args.addressId) {
      await ctx.db.patch(profile._id, { defaultAddress: undefined, country: undefined, city: undefined });
    }

    await ctx.db.delete(args.addressId);
  },
});

export const setDefaultAddress = mutation({
  args: {
    tokenIdentifier: v.string(),
    addressId: v.id("userAddresses"),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    const profile = await ctx.db.query("userProfiles").withIndex("by_user", q => q.eq("userId", user._id)).unique();
    if (!profile) throw new Error("User profile not found.");
    
    const address = await ctx.db.get(args.addressId);
    if (!address) throw new Error("Address not found.");

    // Update default address and sync location
    await ctx.db.patch(profile._id, { defaultAddress: args.addressId, country: address.country, city: address.city });
  },
});