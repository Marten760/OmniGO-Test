import { query } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { ConvexError } from "convex/values";
import { validateToken } from "./util";

export const getStoreAnalytics = query({
  args: {
    tokenIdentifier: v.string(),
    storeId: v.id("stores"),
    period: v.optional(v.union(
      v.literal("today"),
      v.literal("week"),
      v.literal("month"),
      v.literal("year")
    )),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);

    // Verify store ownership
    const store = await ctx.db.get(args.storeId);
    if (!store || store.ownerId !== user.tokenIdentifier) {
      throw new Error("Not authorized to view analytics for this store");
    }

    const period = args.period || "month";
    const now = Date.now();
    let startTime: number;

    switch (period) {
      case "today":
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        startTime = today.getTime();
        break;
      case "week":
        startTime = now - (7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startTime = now - (30 * 24 * 60 * 60 * 1000);
        break;
      case "year":
        startTime = now - (365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = now - (30 * 24 * 60 * 60 * 1000);
    }

    // OPTIMIZATION: Limit the number of orders fetched to prevent OOM on large stores.
    // We analyze the most recent 2000 orders within the period.
    // Get orders for the period
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_store_creation_time", (q) => q.eq("storeId", args.storeId))
      .order("desc") // Ensure we get the latest ones
      .filter((q) => q.gte(q.field("_creationTime"), startTime))
      .take(2000);

    // Calculate analytics
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Order status distribution
    const ordersByStatus = orders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Top selling products
    const productSales = orders.reduce((acc, order) => {
      order.items.forEach(item => {
        const key = item.productId.toString();
        if (!acc[key]) {
          acc[key] = {
            productId: item.productId,
            name: item.name,
            quantity: 0,
            revenue: 0,
          };
        }
        acc[key].quantity += item.quantity;
        acc[key].revenue += item.price * item.quantity;
      });
      return acc;
    }, {} as Record<string, any>);

    const topProducts = Object.values(productSales)
      .sort((a: any, b: any) => b.quantity - a.quantity)
      .slice(0, 10);

    // Revenue by day (for charts)
    const revenueByDay = orders.reduce((acc, order) => {
      const date = new Date(order._creationTime).toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + order.totalAmount;
      return acc;
    }, {} as Record<string, number>);

    // Customer analytics
    const uniqueCustomers = new Set(orders.map(order => order.userId)).size;
    const returningCustomers = orders.reduce((acc, order) => {
      const customerId = order.userId.toString();
      acc[customerId] = (acc[customerId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const returningCustomerCount = Object.values(returningCustomers)
      .filter(count => count > 1).length;

    return {
      overview: {
        totalOrders,
        totalRevenue,
        averageOrderValue,
        totalProducts: store.totalProducts || 0, // OPTIMIZATION: Use stored count
        uniqueCustomers,
        returningCustomers: returningCustomerCount,
        customerRetentionRate: uniqueCustomers > 0 ? (returningCustomerCount / uniqueCustomers) * 100 : 0,
      },
      ordersByStatus,
      topProducts,
      revenueByDay: Object.entries(revenueByDay).map(([date, revenue]) => ({
        date,
        revenue,
      })).sort((a, b) => a.date.localeCompare(b.date)),
      period,
    };
  },
});

export const getStorePerformanceMetrics = query({
  args: {
    tokenIdentifier: v.string(),
    storeId: v.id("stores"),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);

    // Verify store ownership
    const store = await ctx.db.get(args.storeId);
    if (!store || store.ownerId !== user.tokenIdentifier) {
      throw new Error("Not authorized to view metrics for this store");
    }

    // OPTIMIZATION: Limit to last 1000 orders for performance metrics
    // Get all orders for the store
    const allOrders = await ctx.db
      .query("orders")
      .withIndex("by_store_creation_time", (q) => q.eq("storeId", args.storeId))
      .order("desc")
      .take(1000);

    // Calculate metrics
    const totalOrders = allOrders.length;
    const completedOrders = allOrders.filter(order => order.status === "delivered").length;
    const cancelledOrders = allOrders.filter(order => order.status === "cancelled").length;
    
    const completionRate = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;
    const cancellationRate = totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0;

    // Average delivery time for completed orders
    const deliveredOrders = allOrders.filter(order => 
      order.status === "delivered" && order.actualDeliveryTime
    );
    
    const averageDeliveryTime = deliveredOrders.length > 0 
      ? deliveredOrders.reduce((sum, order) => {
          const deliveryTime = order.actualDeliveryTime! - order._creationTime;
          return sum + deliveryTime;
        }, 0) / deliveredOrders.length
      : 0;

    // Review metrics
    // OPTIMIZATION: Use stored aggregates from the store object
    const averageRating = store.rating || 0;
    const totalReviews = store.totalReviews || 0;

    return {
      orders: {
        total: totalOrders,
        completed: completedOrders,
        cancelled: cancelledOrders,
        completionRate,
        cancellationRate,
      },
      delivery: {
        averageTimeMinutes: Math.round(averageDeliveryTime / (1000 * 60)),
      },
      reviews: {
        total: totalReviews,
        averageRating,
      },
      store: {
        name: store.name,
        rating: store.rating,
        totalReviews: store.totalReviews,
      },
    };
  },
});

export const getDashboardSummary = query({
  args: {
    tokenIdentifier: v.string(),
    storeId: v.id("stores"),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);

    // Verify store ownership
    const store = await ctx.db.get(args.storeId);
    if (!store || store.ownerId !== user.tokenIdentifier) {
      throw new Error("Not authorized to view dashboard for this store");
    }

    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = now - (7 * 24 * 60 * 60 * 1000);

    // Get today's orders
    const todayOrders = await ctx.db
      .query("orders")
      .withIndex("by_store_creation_time", (q) => q.eq("storeId", args.storeId))
      .filter((q) => q.gte(q.field("_creationTime"), todayStart.getTime()))
      .take(500); // Limit today's orders fetch

    // Get this week's orders
    const weekOrders = await ctx.db
      .query("orders")
      .withIndex("by_store_creation_time", (q) => q.eq("storeId", args.storeId))
      .filter((q) => q.gte(q.field("_creationTime"), weekStart))
      .take(1000); // Limit week's orders fetch

    // Get pending orders
    const pendingOrders = await ctx.db
      .query("orders")
      .withIndex("by_store_creation_time", (q) => q.eq("storeId", args.storeId))
      .filter((q) => q.neq(q.field("status"), "delivered"))
      .filter((q) => q.neq(q.field("status"), "cancelled"))
      .take(100); // Limit pending orders fetch

    // Get products count
    const products = await ctx.db
      .query("products")
      .withIndex("by_store", (q) => q.eq("storeId", args.storeId))
      .take(2000); // Limit products fetch for active/inactive count

    const activeProducts = products.filter(p => p.isAvailable).length;

    return {
      todayStats: {
        orders: todayOrders.length,
        revenue: todayOrders.reduce((sum, order) => sum + order.totalAmount, 0),
      },
      weekStats: {
        orders: weekOrders.length,
        revenue: weekOrders.reduce((sum, order) => sum + order.totalAmount, 0),
      },
      pending: {
        orders: pendingOrders.length,
      },
      inventory: {
        totalProducts: products.length,
        activeProducts,
        inactiveProducts: products.length - activeProducts,
      },
      store: {
        name: store.name,
        rating: store.rating,
        isOpen: store.isOpen,
      },
    };
  },
});