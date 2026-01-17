import { query, mutation, action, internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { validateToken } from "./util";

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3, delay = 1000): Promise<Response> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response; // إذا نجح، ارجع
      // إذا 401 أو غيره، لا retry
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    } catch (error: any) {
      console.error(`Retry ${i + 1}/${maxRetries} failed:`, error.message);
      if (i === maxRetries - 1) throw error; // آخر محاولة
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i))); // Exponential backoff
    }
  }
  throw new Error('All retries failed');
}

/**
 * جلب بيانات المستخدم بناءً على tokenIdentifier (بدلاً من identity).
 */
export const getUserFromToken = query({
  args: { tokenIdentifier: v.optional(v.string()) },
  handler: async (ctx, args): Promise<(Doc<"users"> & { profile: (Doc<"userProfiles"> & { profileImageUrl: string | null }) | null }) | null> => {
    if (!args.tokenIdentifier) return null;
    
    // In this query, we don't want to throw an error if the user is not found,
    // so we catch it and return null. This is for public-facing data fetching.
    const user = await validateToken(ctx, args.tokenIdentifier).catch((err) => {
      console.warn(`getUserFromToken validation failed: ${err.message}`);
      return null;
    });
    if (!user) return null;

    const profile = await ctx.db.query("userProfiles")
      .withIndex("by_user", q => q.eq("userId", user._id))
      .unique();

    if (!profile) {
      return { ...user, profile: null };
    }

    return { 
      ...user, 
      profile: { ...profile, profileImageUrl: profile.profileImageId ? await ctx.storage.getUrl(profile.profileImageId) : null }
    };
  },
});

// تحديث ملف الشخصية (تعديل لاستخدام validateToken)
export const updateUserProfile = mutation({
  args: {
    tokenIdentifier: v.string(),  // أضف هذا
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    profileImageId: v.optional(v.id("_storage")),
    defaultAddress: v.optional(v.id("userAddresses")),
    dietaryPreferences: v.optional(v.array(v.string())),
    favoritesCuisines: v.optional(v.array(v.string())),
    piWalletAddress: v.optional(v.string()),
    country: v.optional(v.string()),
    city: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    if (!user) {
      // This prevents updates if the token is invalid, enhancing security.
      throw new ConvexError("Authentication failed: Invalid user token.");
    }

    // Update email on the users table if provided
    if (args.email) {
        // Basic email validation
        if (!/\S+@\S+\.\S+/.test(args.email)) {
            throw new ConvexError("Invalid email format.");
        }
        await ctx.db.patch(user._id, { email: args.email });
    }

    let profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    const updateData = {
      firstName: args.firstName ?? profile?.firstName,
      lastName: args.lastName ?? profile?.lastName,
      phone: args.phone ?? profile?.phone,
      profileImageId: args.profileImageId ?? profile?.profileImageId,
      defaultAddress: args.defaultAddress ?? profile?.defaultAddress,
      dietaryPreferences: args.dietaryPreferences ?? profile?.dietaryPreferences ?? [],
      favoritesCuisines: args.favoritesCuisines ?? profile?.favoritesCuisines ?? [],
      walletAddress: args.piWalletAddress ?? profile?.walletAddress,
      country: args.country ?? profile?.country,
      city: args.city ?? profile?.city,
    };
    
    // Only update the wallet address if a valid one is provided.
    if (args.piWalletAddress) {
      updateData.walletAddress = args.piWalletAddress;
      console.log('[auth] Wallet address saved in profile:', args.piWalletAddress.slice(0, 8) + '...');
    } else if (args.piWalletAddress === undefined) {
      // If the argument is not provided at all, we keep the old one. This is the default behavior.
    } else {
      // If an empty string or null is passed, we log a warning and do not update it.
      console.warn('[auth] Wallet address missing in profile update – ensure auth scopes include it. No changes made to wallet address.');
    }

    if (profile) {
      await ctx.db.patch(profile._id, updateData);
    } else {
      await ctx.db.insert("userProfiles", {
        userId: user._id,
        loyaltyPoints: 0,
        ...updateData,
      });
    }

    return { success: true };
  },
});

export const updateUserName = mutation({
  args: {
    tokenIdentifier: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.name.length < 3) {
      throw new ConvexError("Name must be at least 3 characters long.");
    }
    if (args.name.length > 50) {
      throw new ConvexError("Name cannot be longer than 50 characters.");
    }

    const user = await validateToken(ctx, args.tokenIdentifier);
    await ctx.db.patch(user._id, { name: args.name });
    return { success: true };
  },
});

export const setActiveRole = mutation({
  args: {
    tokenIdentifier: v.string(),
    role: v.union(v.literal("driver"), v.literal("customer")),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    if (!profile) {
      throw new ConvexError("User profile not found.");
    }

    // Ensure the user actually has the role they're trying to activate
    if (args.role === 'driver' && !profile.roles?.includes('driver')) {
        throw new ConvexError("User is not authorized to be a driver.");
    }

    await ctx.db.patch(profile._id, { activeRole: args.role });
    return { success: true };
  },
});
// This is now an action because it performs a `fetch` side effect.
export const piSignIn = action({
  args: {
    piUserId: v.string(),
    piUsername: v.string(),
    walletAddress: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ tokenIdentifier: string; success: boolean; }> => {
    const useSandbox = process.env.PI_SANDBOX === 'true';
    const baseUrl = useSandbox ? "https://api.testnet.minepi.com" : "https://api.minepi.com";

    // Call the internal mutation to create/update the user in the database
    const result = await ctx.runMutation(internal.auth.createOrUpdateUser, {
      piUserId: args.piUserId,
      piUsername: args.piUsername, // Pass the username from the client
      walletAddress: args.walletAddress,
      baseUrl,
    });

    console.log("piSignIn - Sign-in result:", result);

    return result;
  },
});

// Internal mutation to handle database operations for user creation/update.
export const createOrUpdateUser = internalMutation({
  args: {
    piUserId: v.string(),
    piUsername: v.string(), // Receive the username
    walletAddress: v.optional(v.string()),
    baseUrl: v.string(),
  },
  handler: async (ctx, { piUserId, piUsername, walletAddress, baseUrl }): Promise<{ tokenIdentifier: string; success: boolean; }> => {
    // Add robust validation and trimming for the piUserId as you suggested.
    const trimmedPiUserId = piUserId?.trim();
    // FIX: The regex was too strict. Pi UIDs can contain hyphens (UUID format).
    // This updated regex allows hex characters and hyphens.
    if (!trimmedPiUserId || !/^[0-9a-fA-F-]{8,}$/.test(trimmedPiUserId)) {
      throw new ConvexError(`Invalid or missing Pi User ID provided: '${piUserId}'`);
    }

    const tokenIdentifier = `${baseUrl}|${trimmedPiUserId}`;
    console.log("createOrUpdateUser - Generated tokenIdentifier:", tokenIdentifier, "for uid:", piUserId);

    console.log('🔍 createOrUpdateUser - Generated tokenIdentifier:', tokenIdentifier, 'for uid:', piUserId);
    let user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .unique();

    if (!user) {
      const userId = await ctx.db.insert("users", {
        name: piUsername, // Use the provided username
        tokenIdentifier: tokenIdentifier,
        // Do not set email here, as we don't have it from Pi.
      });

      await ctx.db.insert("userProfiles", {
        userId: userId,
        piUid: trimmedPiUserId, // Save the trimmed UID
        piUsername: piUsername, // Use the provided username
        walletAddress: walletAddress,
        loyaltyPoints: 0,
        dietaryPreferences: [], 
        favoritesCuisines: [], 
      });
      console.log("createOrUpdateUser - Created new user with ID:", userId, "tokenIdentifier:", tokenIdentifier);

      // Verify insert
      const verifyUser = await ctx.db
        .query("users")
        .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
        .unique();
      console.log('🔍 createOrUpdateUser - verified new user:', verifyUser ? { _id: verifyUser._id, tokenIdentifier: verifyUser.tokenIdentifier } : 'INSERT FAILED');
    } else {
      // If user exists, ensure their name is up-to-date.
      const profilePromise = ctx.db
        .query("userProfiles")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .unique();
      const nameUpdatePromise = user.name !== piUsername
        ? ctx.db.patch(user._id, { name: piUsername })
        : Promise.resolve();

      const [profile] = await Promise.all([profilePromise, nameUpdatePromise]);
      const profileUpdateData: {
        piUid: string;
        piUsername: string;
        walletAddress?: string;
      } = {
        piUid: trimmedPiUserId, // Use the trimmed UID
        piUsername: piUsername,
      };

      // Always update the wallet address with the latest value from Pi SDK,
      // even if it's undefined. This ensures the DB reflects the current state.
      profileUpdateData.walletAddress = walletAddress;

      if (profile) {
        await ctx.db.patch(profile._id, profileUpdateData);
        console.log("createOrUpdateUser - Updated profile for user ID:", user._id);
      } else {
        await ctx.db.insert("userProfiles", { ...profileUpdateData, userId: user._id, loyaltyPoints: 0, dietaryPreferences: [], favoritesCuisines: [] });
        console.log("createOrUpdateUser - Created new profile for existing user ID:", user._id);
      }
      if (user.name !== piUsername) console.log("createOrUpdateUser - Updated user name for ID:", user._id);
      console.log('🔍 createOrUpdateUser - verified updated user:', user ? { _id: user._id, tokenIdentifier: user.tokenIdentifier } : 'UPDATE FAILED');
    }

    // After updating profile...
    console.log(`createOrUpdateUser - Final Wallet: ${walletAddress ? `${walletAddress.slice(0, 8)}...` : 'NONE'}`);

    // If no walletAddress provided, log warning (but don't fail, as it might be optional initially)
    if (!walletAddress) {
      console.warn(`No walletAddress provided for user ${piUserId}. Re-authentication may be needed later.`);
    }
    
    // After creating or updating the user profile, ensure all their stores have the latest wallet address.
    await ctx.runMutation(internal.stores.updateStoreWalletsOnProfileUpdate, {
      tokenIdentifier,
      walletAddress: walletAddress,
      piUid: trimmedPiUserId, // Pass the trimmed piUid to sync with stores
    });

    return { tokenIdentifier: tokenIdentifier, success: true };
  }
});

export const linkPiAccount = mutation({
  args: { 
    tokenIdentifier: v.string(), 
    piUid: v.string(), 
    piUsername: v.optional(v.string()),
    walletAddress: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    console.log(`[linkPiAccount] Linking Pi account for user. UID: ${args.piUid}`);
    const user = await validateToken(ctx, args.tokenIdentifier);
    if (!user) throw new Error("Unauthorized.");
    
    let profile = await ctx.db.query("userProfiles")
      .withIndex("by_user", q => q.eq("userId", user._id)).unique();
    
    const updateData: Partial<Doc<"userProfiles">> = { piUid: args.piUid, walletAddress: args.walletAddress };
    if (args.piUsername) updateData.piUsername = args.piUsername;
    
    if (profile) {
      await ctx.db.patch(profile._id, updateData);
    } else {
      await ctx.db.insert("userProfiles", { ...updateData, userId: user._id, loyaltyPoints: 0, dietaryPreferences: [], favoritesCuisines: [] });
    }
    
    // After updating the profile, ensure the stores are synced with the new info
    await ctx.runMutation(internal.stores.updateStoreWalletsOnProfileUpdate, {
      tokenIdentifier: args.tokenIdentifier,
      walletAddress: args.walletAddress,
      piUid: args.piUid,
    });

    return { success: true };
  },
});