import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { validateToken } from "./util";
import { Id } from "./_generated/dataModel";

// This file will contain all review-related queries and mutations.

// Query to get all reviews for a specific user
export const getUserReviews = query({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    // Join with store data
    return Promise.all(
      reviews.map(async (review) => {
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
    );
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

    // Efficiently fetch all user and profile data in fewer queries
    const userIds = [...new Set(reviews.map(r => r.userId))];
    const users = await ctx.db.query("users").filter(q => q.or(...userIds.map(id => q.eq(q.field("_id"), id)))).collect();
    const profiles = await ctx.db.query("userProfiles").filter(q => q.or(...userIds.map(id => q.eq(q.field("userId"), id)))).collect();

    const usersById = new Map(users.map(u => [u._id, u]));
    const profilesByUserId = new Map(profiles.map(p => [p.userId, p]));

    return Promise.all(
      reviews.map(async (review) => {
        const user = usersById.get(review.userId);
        const userProfile = profilesByUserId.get(review.userId);
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
    
    // After adding the review, recalculate the store's average rating
    const allReviews = await ctx.db
      .query("reviews")
      .withIndex("by_store", (q) => q.eq("storeId", args.storeId))
      .collect();

    const totalReviews = allReviews.length;
    const sumOfRatings = allReviews.reduce((sum, review) => sum + review.rating, 0);
    const newAverageRating = totalReviews > 0 ? sumOfRatings / totalReviews : 0;

    await ctx.db.patch(args.storeId, {
      rating: newAverageRating,
      totalReviews: totalReviews,
    });
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

    // After updating the review, recalculate the store's average rating
    const allReviews = await ctx.db
      .query("reviews")
      .withIndex("by_store", (q) => q.eq("storeId", review.storeId))
      .collect();

    const totalReviews = allReviews.length;
    const sumOfRatings = allReviews.reduce((sum, review) => sum + review.rating, 0);
    const newAverageRating = totalReviews > 0 ? sumOfRatings / totalReviews : 0;

    await ctx.db.patch(review.storeId, {
      rating: newAverageRating,
      totalReviews: totalReviews,
    });
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

    // After deleting the review, recalculate the store's average rating
    const allReviews = await ctx.db
      .query("reviews")
      .withIndex("by_store", (q) => q.eq("storeId", storeId))
      .collect();

    const totalReviews = allReviews.length;
    const sumOfRatings = allReviews.reduce((sum, review) => sum + review.rating, 0);
    const newAverageRating = totalReviews > 0 ? sumOfRatings / totalReviews : 0;

    await ctx.db.patch(storeId, {
      rating: newAverageRating,
      totalReviews: totalReviews,
    });
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