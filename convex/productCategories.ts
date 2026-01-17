import { query, mutation, type MutationCtx, type QueryCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { validateToken } from "./util";

// Helper to check ownership of a store
const checkOwnership = async (ctx: MutationCtx | QueryCtx, tokenIdentifier: string, storeId: Id<"stores">) => {
    const user = await validateToken(ctx, tokenIdentifier);
    const store = await ctx.db.get(storeId);
    if (!store || store.ownerId !== user.tokenIdentifier) {
        throw new Error("You do not have permission for this store.");
    }
    return true;
};

export const getForStore = query({
    args: { storeId: v.id("stores") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("productCategories")
            .withIndex("by_store", q => q.eq("storeId", args.storeId))
            .collect();
    },
});

export const addCategory = mutation({
    args: {
        tokenIdentifier: v.string(),
        storeId: v.id("stores"),
        name: v.string(),
    },
    handler: async (ctx, { tokenIdentifier, storeId, name }) => {
        await checkOwnership(ctx, tokenIdentifier, storeId);
        const trimmedName = name.trim();
        if (!trimmedName) {
            throw new Error("Category name cannot be empty.");
        }

        // Check for duplicates (case-insensitive) for the same store
        const existing = await ctx.db
            .query("productCategories")
            .withIndex("by_store", q => q.eq("storeId", storeId))
            .collect();
        
        if (existing.some(cat => cat.name.toLowerCase() === trimmedName.toLowerCase())) {
            throw new Error(`Category "${trimmedName}" already exists for this store.`);
        }

        return await ctx.db.insert("productCategories", {
            storeId,
            name: trimmedName,
        });
    },
});

export const updateCategory = mutation({
  args: {
    tokenIdentifier: v.string(),
    categoryId: v.id("productCategories"),
    newName: v.string(),
  },
  handler: async (ctx, args) => {
    const category = await ctx.db.get(args.categoryId);
    if (!category) {
      throw new Error("Category not found.");
    }
    await checkOwnership(ctx, args.tokenIdentifier, category.storeId);

    const trimmedNewName = args.newName.trim();
    if (!trimmedNewName) {
        throw new Error("Category name cannot be empty.");
    }

    // Check if the new name already exists in the same store
    const existing = await ctx.db
        .query("productCategories")
        .withIndex("by_store", q => q.eq("storeId", category.storeId))
        .filter(q => q.eq(q.field("name"), trimmedNewName))
        .filter(q => q.neq(q.field("_id"), args.categoryId)) // Exclude the current category
        .first();
    if (existing) {
        throw new Error(`Category "${trimmedNewName}" already exists for this store.`);
    }

    const oldCategoryName = category.name;
    await ctx.db.patch(args.categoryId, { name: trimmedNewName });

    // Find all products with the old category name in this store and update them
    const productsToUpdate = await ctx.db
      .query("products")
      .withIndex("by_store", (q) => q.eq("storeId", category.storeId))
      .filter((q) => q.eq(q.field("category"), oldCategoryName))
      .collect();

    await Promise.all(productsToUpdate.map(item => ctx.db.patch(item._id, { category: trimmedNewName })));
  },
});

export const deleteCategory = mutation({
    args: { 
        tokenIdentifier: v.string(),
        categoryId: v.id("productCategories") 
    },
    handler: async (ctx, { tokenIdentifier, categoryId }) => {
        const category = await ctx.db.get(categoryId);
        if (!category) {
            throw new Error("Category not found.");
        }
        await checkOwnership(ctx, tokenIdentifier, category.storeId);

        // Check if category is in use before deleting
        const itemsInCategory = await ctx.db
            .query("products")
            .withIndex("by_store", q => q.eq("storeId", category.storeId))
            .filter(q => q.eq(q.field("category"), category.name))
            .first();

        if (itemsInCategory) {
            throw new Error(`Cannot delete category "${category.name}" as it is currently used by one or more products.`);
        }

        await ctx.db.delete(categoryId);
    },
});