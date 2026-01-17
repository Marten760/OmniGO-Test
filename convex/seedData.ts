import { mutation } from "./_generated/server";
import { Doc, Id, TableNames } from "./_generated/dataModel";
import { v, ConvexError } from "convex/values";
import { validateToken } from "./util";

export const seedDatabase = mutation({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    const userId = user.tokenIdentifier; // tokenIdentifier for the authenticated user (demo store owner)

    // Helper function to clear a table
    const clearTable = async (tableName: TableNames) => {
      const items = await ctx.db.query(tableName).collect();
      await Promise.all(items.map(item => ctx.db.delete(item._id)));
      console.log(`Cleared table: ${tableName}`);
    };

    // List of all application-specific tables to clear
    const tablesToClear: TableNames[] = [
      "stores",
      "products",
      "productCategories",
      "reviews",
      "orders",
      "follows",
      "productFavorites",
      "notifications",
      "discounts",
      "campaigns",
      "piPayments",
    ];

    // Clear all tables
    for (const tableName of tablesToClear) {
      await clearTable(tableName);
    }

    // Add sample data (seeding) - check if stores exist first
    const existingStores = await ctx.db.query("stores").collect();
    if (existingStores.length === 0) {
      // Create a demo store linked to the user (ownerId = tokenIdentifier)
      const sampleStoreId = await ctx.db.insert("stores", {
        name: "OmniGo Test Pizza",
        description: "تجربة متجر بيتزا في نيويورك",
        categories: ["Pizza", "Italian"],
        tags: ["Fast Food"],
        storeType: "restaurant",
        priceRange: ["$$"],
        rating: 4.5,
        totalReviews: 100,
        country: "United States",
        region: "New York",
        address: "123 Main St, New York",
        hasDelivery: true,
        isOpen: true,
        openingHours: [
          { day: "Monday", isOpen: true, open: "09:00", close: "22:00" },
          { day: "Tuesday", isOpen: true, open: "09:00", close: "22:00" },
          { day: "Wednesday", isOpen: true, open: "09:00", close: "22:00" },
          { day: "Thursday", isOpen: true, open: "09:00", close: "22:00" },
          { day: "Friday", isOpen: true, open: "09:00", close: "23:00" },
          { day: "Saturday", isOpen: true, open: "10:00", close: "23:00" },
          { day: "Sunday", isOpen: true, open: "10:00", close: "21:00" },
        ],
        phone: "+1-123-456-7890",
        dietaryOptions: ["vegetarian", "gluten-free"],
        isTrending: true,
        hasOffer: true,
        offerText: "10% off first order",
        ownerId: userId, // Link to the current account holder
      });

      // Add products to the store
      await ctx.db.insert("products", {
        storeId: sampleStoreId,
        name: "Margherita Pizza",
        description: "كلاسيكية بيتزا مارغريتا",
        price: 12.99,
        category: "Pizza",
        dietaryInfo: ["vegetarian"],
        isAvailable: true,
        isPopular: true,
        ingredients: [],
      });

      // Add a sample discount
      await ctx.db.insert("discounts", {
        storeId: sampleStoreId,
        code: "TEST10",
        type: "percentage",
        value: 10,
        minOrderValue: 20,
        isActive: true,
        timesUsed: 0,
        targetUsers: "all",
      });

      console.log("Seeded sample data successfully.");
    } else {
      console.log("Data already exists; skipping seeding.");
    }

    return "Database cleared and seeded successfully.";
  },
});
