import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { validateToken } from "./util";
import { Id } from "./_generated/dataModel";

// This file will contain all review-related queries and mutations.

// Query to get all reviews for a specific user
export const getUserReviews = query({
  args: { 
    tokenIdentifier: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    const result = await ctx.db
      .query("reviews")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .paginate(args.paginationOpts);

    // Join with store data
    return {
      ...result,
      page: await Promise.all(
        result.page.map(async (review) => {
        const store = await ctx.db.get(review.storeId);
        const imageUrls = review.imageIds
          ? await Promise.all(review.imageIds.map((id) => ctx.storage.getUrl(id)))
          : [];

        return {
          ...review,
          storeName: store?.name ?? "Unknown Store",
          imageUrls: imageUrls.filter((url): url is string => url !== null),
        };
      })
      )
    };
  },
});

/**
 * Query to get the average rating a user has given across all their reviews.
 */
export const getUserAverageRating = query({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    if (reviews.length === 0) {
      return 0; // Return 0 if the user has no reviews
    }

    const sumOfRatings = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = sumOfRatings / reviews.length;

    return averageRating;
  },
});

export const getStoreReviews = query({
  args: {
    storeId: v.id("stores"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_store", (q) => q.eq("storeId", args.storeId))
      .order("desc")
      .take(args.limit || 100); // Default to 100 if no limit

    if (reviews.length === 0) return [];

    return Promise.all(
      reviews.map(async (review) => {
        // OPTIMIZATION: Fetch user details individually. 
        // Using .filter(q => q.or(...)) with many IDs can hit query limits.
        // Convex handles parallel get/query requests efficiently.
        const [user, userProfile] = await Promise.all([
          ctx.db.get(review.userId),
          ctx.db.query("userProfiles").withIndex("by_user", q => q.eq("userId", review.userId)).unique()
        ]);
        const userImage = userProfile?.profileImageId ? await ctx.storage.getUrl(userProfile.profileImageId) : null;

        return {
          ...review,
          userName: user?.name ?? "Anonymous",
          userImage: userImage,
        };
      })
    );
  },
});

export const hasUserReviewedStore = query({
  args: {
    tokenIdentifier: v.string(),
    storeId: v.id("stores"),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier).catch(() => null);
    if (!user) return false;

    const existingReview = await ctx.db.query("reviews")
      .withIndex("by_user_and_store", q => q.eq("userId", user._id).eq("storeId", args.storeId))
      .first();

    return !!existingReview;
  },
});

export const addReview = mutation({
  args: {
    tokenIdentifier: v.string(),
    storeId: v.id("stores"),
    rating: v.number(),
    comment: v.string(),
    imageIds: v.array(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);

    // Check if user has already reviewed this store
    const existingReview = await ctx.db.query("reviews")
      .withIndex("by_user_and_store", q => q.eq("userId", user._id).eq("storeId", args.storeId))
      .first();

    if (existingReview) {
      throw new ConvexError("You have already reviewed this store.");
    }

    // Check if the user has a completed order from this store to verify the purchase.
    const completedOrder = await ctx.db
      .query("orders")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) =>
        q.and(
          q.eq(q.field("storeId"), args.storeId),
          q.eq(q.field("status"), "delivered")
        )
      )
      .first();

    const { tokenIdentifier, ...reviewData } = args;
    await ctx.db.insert("reviews", { ...reviewData, userId: user._id, isVerifiedPurchase: !!completedOrder, helpfulCount: 0, reportCount: 0 });
    
    // OPTIMIZATION: Incrementally update store rating instead of fetching all reviews (O(1) vs O(N))
    const store = await ctx.db.get(args.storeId);
    if (store) {
      const oldTotal = store.totalReviews || 0;
      const oldRating = store.rating || 0;
      const newTotal = oldTotal + 1;
      // Formula: NewAvg = ((OldAvg * OldCount) + NewRating) / NewCount
      const newRating = ((oldRating * oldTotal) + args.rating) / newTotal;
      await ctx.db.patch(args.storeId, { rating: newRating, totalReviews: newTotal });
    }
  },
});

// Mutation to update a review
export const updateReview = mutation({
  args: {
    tokenIdentifier: v.string(),
    reviewId: v.id("reviews"),
    rating: v.number(),
    comment: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    const review = await ctx.db.get(args.reviewId);

    if (!review || review.userId !== user._id) {
      throw new Error("Review not found or permission denied.");
    }

    await ctx.db.patch(args.reviewId, {
      rating: args.rating,
      comment: args.comment,
    });

    // OPTIMIZATION: Incrementally update store rating
    const store = await ctx.db.get(review.storeId);
    if (store) {
      const total = store.totalReviews || 1;
      const oldRatingAvg = store.rating || 0;
      // Formula: NewAvg = ((OldAvg * Count) - OldRating + NewRating) / Count
      const newRating = ((oldRatingAvg * total) - review.rating + args.rating) / total;
      await ctx.db.patch(review.storeId, { rating: newRating });
    }
  },
});

// Mutation to delete a review
export const deleteReview = mutation({
  args: {
    tokenIdentifier: v.string(),
    reviewId: v.id("reviews"),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    const review = await ctx.db.get(args.reviewId);

    if (!review || review.userId !== user._id) {
      throw new Error("Review not found or permission denied.");
    }

    const storeId = review.storeId; // Save storeId before deleting

    if (review.imageIds && review.imageIds.length > 0) {
      await Promise.all(review.imageIds.map((id) => ctx.storage.delete(id)));
    }

    await ctx.db.delete(args.reviewId);

    // OPTIMIZATION: Incrementally update store rating
    const store = await ctx.db.get(storeId);
    if (store) {
      const total = store.totalReviews || 1;
      const oldRatingAvg = store.rating || 0;
      const newTotal = Math.max(0, total - 1);
      // Formula: NewAvg = ((OldAvg * Count) - OldRating) / (Count - 1)
      const newRating = newTotal > 0 ? ((oldRatingAvg * total) - review.rating) / newTotal : 0;
      
      await ctx.db.patch(storeId, { rating: newRating, totalReviews: newTotal });
    }
  },
});

export const reportReview = mutation({
  args: {
    tokenIdentifier: v.string(),
    reviewId: v.id("reviews"),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    const review = await ctx.db.get(args.reviewId);

    if (!review) {
      throw new ConvexError("Review not found.");
    }

    // Prevent user from reporting their own review
    if (review.userId === user._id) {
      throw new ConvexError("You cannot report your own review.");
    }

    // Check if the user has already reported this review
    const existingReport = await ctx.db
      .query("reviewReports")
      .withIndex("by_review_and_user", (q) =>
        q.eq("reviewId", args.reviewId).eq("userId", user._id)
      )
      .first();

    if (existingReport) {
      throw new ConvexError("You have already reported this review.");
    }

    // Create a report record and increment the report count
    await ctx.db.insert("reviewReports", { reviewId: args.reviewId, userId: user._id });
    await ctx.db.patch(args.reviewId, { reportCount: review.reportCount + 1 });

    return { success: true };
  },
});

export const generateUploadUrl = mutation(async (ctx) => {
  return await ctx.storage.generateUploadUrl();
});