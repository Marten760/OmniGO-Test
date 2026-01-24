import { defineSchema, defineTable } from "convex/server";
import { v, Validator } from "convex/values";
import { Id } from "./_generated/dataModel";

const authTables = {
  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    role: v.optional(v.union(v.literal("admin"), v.literal("user"))),
    tokenIdentifier: v.string(),
    profileImageUrl: v.optional(v.string()), // Add profile image URL field
    blockedUsers: v.optional(v.array(v.id("users"))),
  })
    .index("email", ["email"])
    .index("by_tokenIdentifier", ["tokenIdentifier"]),
};

const applicationTables = {
  regions: defineTable({
    country: v.string(),
    region: v.string(),
    isActive: v.boolean(),
  }).index("by_country", ["country"]),

  stores: defineTable({
    name: v.string(),
    description: v.string(),
    // Allow multiple categories for a store
    categories: v.array(v.string()), // e.g., ["Pizza", "Burgers", "Italian"]
    tags: v.optional(v.array(v.string())), // e.g., ["Pizza", "Pasta", "Health", "Beauty", "Gaming"]
    storeType: v.union( // Add store type for filtering
      v.literal("restaurant"),
      v.literal("pharmacy"),
      v.literal("grocery"),
      v.literal("electronics"),
      v.literal("clothing"),
      v.literal("games"),
      v.literal("services"),
      v.literal("other"),
    ),
    priceRange: v.array(v.string()), // Changed to array: ["$", "$$"]
    rating: v.number(),
    totalReviews: v.number(),
    totalProducts: v.optional(v.number()),
    logoImageId: v.optional(v.id("_storage")), // Renamed for clarity
    galleryImageIds: v.optional(v.array(v.id("_storage"))), // For multiple store images
    country: v.string(),
    region: v.string(),
    address: v.string(),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    hasDelivery: v.boolean(),
    isOpen: v.boolean(),
    openingHours: v.array(v.object({
      day: v.string(), // e.g., "Sunday", "Monday"
      isOpen: v.boolean(),
      open: v.string(), // "HH:mm" format, e.g., "09:00"
      close: v.string(), // "HH:mm" format, e.g., "23:00"
    })),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    dietaryOptions: v.array(v.string()), // ["vegetarian", "vegan", "gluten-free", "halal"]
    isTrending: v.boolean(),
    hasOffer: v.boolean(),
    offerText: v.optional(v.string()),
    // Temporarily allow string for anonymous users to test store creation.
    // With custom auth, the ownerId is the identity.subject, which is a string.
    ownerId: v.string(), // Add owner ID to associate restaurant with user
    piWalletAddress: v.optional(v.string()), // Pi Wallet address for payouts
    piUid: v.optional(v.string()), // Pi User ID for A2U payouts
    isRecruitingDrivers: v.optional(v.boolean()), // To control the "Work with us" button
    privacyPolicyUrl: v.optional(v.string()),
    termsOfServiceUrl: v.optional(v.string()),
    deliveryRegions: v.optional(v.array(v.string())), // List of region names (cities) for delivery restrictions
    isDeliveryRegionsAllowList: v.optional(v.boolean()), // true = allow only these, false = block these
  })
    .index("by_region", ["country", "region"])
    .index("by_region_type", ["country", "region", "storeType"]) // فهرس جديد للبحث السريع
    .index("by_categories", ["categories"]) // Corrected index name for consistency
    .index("by_rating", ["rating"])
    .index("by_trending", ["isTrending", "country", "region"])
    .index("by_owner", ["ownerId"]) // Add index for owner queries
    .searchIndex("search_all", {
      searchField: "name",
      filterFields: ["country", "region", "categories", "storeType", "hasDelivery"]
    }),

  discounts: defineTable({
    storeId: v.id("stores"),
    code: v.string(),
    type: v.union(v.literal("percentage"), v.literal("fixed")),
    value: v.number(),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    minOrderValue: v.optional(v.number()),
    usageLimit: v.optional(v.number()), // Total usage limit
    usageLimitPerUser: v.optional(v.number()), // Limit per user (e.g., 1 for once per user)
    timesUsed: v.number(), // Counter for total usage
    targetUsers: v.union(v.literal("all"), v.literal("new_users_only")),
    isActive: v.boolean(),
  })
    .index("by_storeId_and_code", ["storeId", "code"])
    .index("by_storeId", ["storeId"]),

  campaigns: defineTable({
    storeId: v.id("stores"),
    subject: v.string(),
    content: v.string(),
    sentAt: v.number(),
  }).index("by_storeId", ["storeId"]),

  products: defineTable({
    storeId: v.id("stores"),
    name: v.string(),
    description: v.string(),
    price: v.number(), // in pi coins
    category: v.string(), // e.g., "Appetizers", "Mains", "Electronics", "Skincare"
    image: v.optional(v.string()), // URL or path to image
    imageId: v.optional(v.id("_storage")),
    imageIds: v.optional(v.array(v.id("_storage"))), // Add this line
    available: v.optional(v.boolean()), // Add available field for frontend compatibility
    isAvailable: v.boolean(),
    isPopular: v.boolean(),
    dietaryInfo: v.optional(v.array(v.string())), // Make optional as it's mostly for food
    ingredients: v.array(v.string()),
    calories: v.optional(v.number()),
    preparationTime: v.optional(v.string()),
    spiceLevel: v.optional(v.string()), // "mild", "medium", "hot", "very hot"
    quantity: v.optional(v.number()), // For stock tracking in non-restaurant stores
    options: v.optional(v.array(v.object({
      title: v.string(),
      type: v.union(v.literal("single"), v.literal("multiple")),
      choices: v.array(v.object({
        name: v.string(),
        price_increment: v.number(),
        quantity: v.optional(v.number()), // For option-level stock
        ingredients: v.optional(v.string()),
      })),
    }))),
  })
    .index("by_store", ["storeId"])
    .index("by_category", ["category"])
    .index("by_popular", ["isPopular"])
    .searchIndex("search_all", {
      searchField: "name",
      filterFields: ["storeId", "category", "isAvailable"]
    }),

  productCategories: defineTable({
    storeId: v.id("stores"),
    name: v.string(),
  }).index("by_store", ["storeId"]),

  // Add cart items table
  cartItems: defineTable({
    userId: v.id("users"),
    storeId: v.id("stores"),
    productId: v.id("products"),
    quantity: v.number(),
    options: v.optional(v.any()),
    specialInstructions: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_product", ["userId", "productId"])
    .index("by_user_store", ["userId", "storeId"]),

  reviews: defineTable({
    storeId: v.id("stores"),
    userId: v.id("users"),
    rating: v.number(), // 1-5 stars
    comment: v.string(),
    imageIds: v.array(v.id("_storage")),
    isVerifiedPurchase: v.boolean(),
    helpfulCount: v.number(),
    reportCount: v.number(),
  })
    .index("by_store", ["storeId"])
    .index("by_user", ["userId"])
    .index("by_rating", ["rating"])
    .index("by_user_and_store", ["userId", "storeId"]),

  reviewReports: defineTable({
    reviewId: v.id("reviews"),
    userId: v.id("users"), // The user who is reporting
  }).index("by_review_and_user", ["reviewId", "userId"]),

  orders: defineTable({
    userId: v.id("users"),
    storeId: v.id("stores"),
    storeName: v.string(),
    items: v.array(v.object({
      productId: v.id("products"),
      name: v.string(),
      description: v.optional(v.string()), // Add the missing description field
      quantity: v.number(),
      price: v.number(),
      specialInstructions: v.optional(v.string()),
      options: v.optional(v.any()),
      imageUrl: v.optional(v.string()),
    })),
    totalAmount: v.number(), // in pi coins
    discountId: v.optional(v.id("discounts")),
    discountAmount: v.optional(v.number()),
    deliveryFee: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("preparing"),
      v.literal("out_for_delivery"),
      v.literal("delivered"),
      v.literal("cancelled"),
      v.literal("disputed")
    ),
    driverId: v.optional(v.id("users")), // The user ID of the assigned driver
    customerName: v.optional(v.string()), // Add customer name to the order
    deliveryAddress: v.string(),
    customerNotes: v.optional(v.string()),
    estimatedDeliveryTime: v.string(),
    actualDeliveryTime: v.optional(v.number()),
    paymentMethod: v.string(), // "pi_coin", "card", "cash"
    paymentStatus: v.string(), // "pending", "paid", "refunded"
    piPaymentId: v.optional(v.string()), // Link to Pi payment
    txid: v.optional(v.string()), // Pi blockchain transaction ID
    paymentRecordId: v.optional(v.id("piPayments")), // Link to the internal payment record
    scheduledPayoutId: v.optional(v.id("_scheduled_functions")), // ID of the scheduled payout job
  })
    .index("by_user", ["userId"])
    .index("by_store_creation_time", ["storeId"]) // Renamed for clarity and removed _creationTime
    .index("by_status", ["status"])
    .index("by_user_and_discount", ["userId", "discountId"])
    .index("by_pi_payment_id", ["piPaymentId"]) // Add index for Pi payments
    .searchIndex("search_customer_name", {
      searchField: "customerName",
      filterFields: ["storeId"],
    }),
  
  // Table for users following stores
  follows: defineTable({
    userId: v.id("users"),
    storeId: v.id("stores"),
  })
    .index("by_user", ["userId"])
    .index("by_user_store", ["userId", "storeId"])
    .index("by_store", ["storeId"]),

  // Table for users liking stores
  storeFavorites: defineTable({
    userId: v.id("users"),
    storeId: v.id("stores"),
  })
    .index("by_user", ["userId"])
    .index("by_user_store", ["userId", "storeId"]),

  // Table for users liking products
  productFavorites: defineTable({
    userId: v.id("users"),
    productId: v.id("products"),
  })
    .index("by_user", ["userId"])
    .index("by_user_product", ["userId", "productId"]),

  promotions: defineTable({
    storeId: v.id("stores"), // The store that created the ad
    title: v.string(),
    description: v.optional(v.string()),
    imageId: v.id("_storage"),
    badgeText: v.optional(v.string()),
    targetStoreId: v.id("stores"), // The store the ad links to
    startDate: v.string(), // ISO 8601 format
    endDate: v.string(), // ISO 8601 format
    status: v.union(v.literal("active"), v.literal("draft"), v.literal("archived")),
  })
    .index("by_store", ["storeId"]),

  reports: defineTable({
    orderId: v.id("orders"),
    userId: v.id("users"), // The customer reporting
    storeId: v.id("stores"),
    reason: v.string(),
    description: v.string(),
    imageIds: v.optional(v.array(v.id("_storage"))),
    status: v.union(v.literal("open"), v.literal("resolved"), v.literal("rejected")),
    resolution: v.optional(v.string()),
  })
    .index("by_order", ["orderId"])
    .index("by_store", ["storeId"]),

  notifications: defineTable({
    userId: v.id("users"), // The user to notify (restaurant owner)
    orderId: v.optional(v.id("orders")),
    storeId: v.optional(v.id("stores")),
    message: v.string(),
    isRead: v.boolean(),
    type: v.union(v.literal("new_order"), v.literal("status_update"), v.literal("promotion")),
  })
    .index("by_user", ["userId"])
    .index("by_user_read_status", ["userId", "isRead"]),
  
  userAddresses: defineTable({
    userId: v.id("users"),
    label: v.string(), // "Home", "Work", etc.
    address: v.string(),
    city: v.string(),
    country: v.string(),
    postalCode: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
  }).index("by_user", ["userId"]),
  
  supportTickets: defineTable({
    userId: v.id("users"),
    userEmail: v.optional(v.string()),
    userName: v.optional(v.string()),
    subject: v.string(),
    message: v.string(),
    status: v.union(v.literal("open"), v.literal("in_progress"), v.literal("closed")),
  }).index("by_user", ["userId"]).index("by_status", ["status"]),
  
  userProfiles: defineTable({
    userId: v.id("users"),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    profileImageId: v.optional(v.id("_storage")),
    phone: v.optional(v.string()),
    defaultAddress: v.optional(v.id("userAddresses")),
    dietaryPreferences: v.array(v.string()),
    favoritesCuisines: v.array(v.string()),
    loyaltyPoints: v.number(),
    piUid: v.optional(v.string()), // Pi Network user ID
    roles: v.optional(v.array(v.string())), // e.g., ["store_owner", "driver"]
    activeRole: v.optional(v.union(v.literal("driver"), v.literal("customer"))),
    piUsername: v.optional(v.string()), // Pi Network username
    walletAddress: v.optional(v.string()), // Pi Network wallet address
    country: v.optional(v.string()), // User's current country for delivery validation
    city: v.optional(v.string()), // User's current city for delivery validation
  }).index("by_user", ["userId"])
    .index("by_pi_uid", ["piUid"]),

  piPayments: defineTable({
    paymentId: v.string(), // The ID from the Pi SDK on the client
    userId: v.optional(v.id("users")), // The user in your app's database
    amount: v.number(),
    memo: v.string(),
    metadata: v.any(),
    status: v.string(), // "pending", "approved", "completed", "cancelled", "failed"
    txid: v.optional(v.string()),
    orderId: v.optional(v.id("orders")),
    failureReason: v.optional(v.string()), // To store reasons for failed/cancelled payments
    processed: v.optional(v.boolean()), // NEW: To ensure idempotent order creation
  }).index("by_payment_id", ["paymentId"]) // Changed from by_paymentId
    .index("by_user_and_status", ["userId", "status"]) // Add index for finding ongoing payments
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  // Table to link stores with their drivers
  storeDrivers: defineTable({
    storeId: v.id("stores"),
    driverId: v.id("users"), // The user ID of the driver
    status: v.union(v.literal("active"), v.literal("inactive"), v.literal("pending")),
  }).index("by_store_and_driver", ["storeId", "driverId"])
    .index("by_driver", ["driverId"])
    .index("by_store", ["storeId"]),

  appSettings: defineTable({
    key: v.string(),
    value: v.any(),
  }).index("by_key", ["key"]),
};

const presenceTable = {
  presence: defineTable({
    userId: v.id("users"),
    lastSeen: v.number(),
  }).index("by_user", ["userId"]),
};

const applicationTablesWithDiscounts = {
  ...applicationTables,
  discountUsages: defineTable({
    discountId: v.id("discounts"),
    userId: v.id("users"),
    orderId: v.optional(v.id("orders")),
    usedAt: v.number(),
  })
    .index("by_discount", ["discountId"])
    .index("by_discount_and_user", ["discountId", "userId"]),

  conversations: defineTable({
    participants: v.array(v.id("users")),
    orderId: v.optional(v.id("orders")),
    lastMessage: v.optional(v.string()),
    lastMessageSenderId: v.optional(v.id("users")),
    updatedAt: v.number(),
    unreadCounts: v.any(), // Use v.any() for dynamic objects (maps/dictionaries)
    typingStatus: v.optional(v.any()), // To store { [userId]: timestamp }
    isArchived: v.optional(v.boolean()), // To close chats after order completion
  })
    .index("by_user_and_updated_at", ["participants", "updatedAt"])
    .index("by_participant", ["participants"])
    .index("by_updatedAt", ["updatedAt"]) // إضافة جديدة لدعم .order("desc") حسب updatedAt
    .index("by_order", ["orderId"]), // فهرس جديد للبحث عن محادثة الطلب

  messages: defineTable({
    conversationId: v.id("conversations"),
    senderId: v.id("users"),
    text: v.string(),
    imageIds: v.optional(v.array(v.id("_storage"))),
    type: v.union(v.literal("text"), v.literal("image"), v.literal("voice")),
    status: v.union(v.literal("sent"), v.literal("delivered"), v.literal("read")),
    isDeleted: v.boolean(),
    createdAt: v.number(), // إضافة جديدة للترتيب الزمني
    repliedToMessageId: v.optional(v.id("messages")),
    repliedToMessageText: v.optional(v.string()),
    repliedToMessageSender: v.optional(v.string()),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_conversation_created", ["conversationId", "createdAt"]), // index جديد للترتيب الفعال

  userConversations: defineTable({
    userId: v.id("users"),
    conversationId: v.id("conversations"),
    updatedAt: v.number(),
    isArchived: v.optional(v.boolean()),
  })
    .index("by_user_updated", ["userId", "updatedAt"])
    .index("by_user_archived_updated", ["userId", "isArchived", "updatedAt"])
    .index("by_conversation", ["conversationId"]),
};

const payoutTables = {
  payouts: defineTable({
    storeId: v.id("stores"),
    orderId: v.id("orders"),
    amount: v.number(),
    txid: v.optional(v.string()),
    status: v.string(),
    failureReason: v.optional(v.string()),
  }).index("by_store", ["storeId"])
    .index("by_order", ["orderId"]), // Add index to prevent duplicate payouts
};



const pushNotificationTables = {
  pushTokens: defineTable({
    userId: v.id("users"),
    subscription: v.any(), // Stores the PushSubscription object from the browser
  }).index("by_user", ["userId"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTablesWithDiscounts,
  ...payoutTables,
  ...presenceTable,
  ...pushNotificationTables,
});