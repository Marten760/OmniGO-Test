import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { validateToken } from "./util";

// Query: Find or create a conversation between two users
export const findOrCreateConversation = mutation({
  args: {
    tokenIdentifier: v.string(),
    storeId: v.id("stores"),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);

    const store = await ctx.db.get(args.storeId);
    if (!store) {
      throw new Error("Store not found");
    }

    const storeOwner = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", store.ownerId))
      .unique();

    if (!storeOwner) {
      throw new Error("Store owner not found");
    }

    const participants = [user._id, storeOwner._id].sort();

    let conversation = await ctx.db
      .query("conversations")
      .withIndex("by_user_and_updated_at", (q) =>
        q.eq("participants", participants)
      )
      .first();

    if (conversation) {
      return conversation._id;
    }

    const conversationId = await ctx.db.insert("conversations", {
      participants,
      updatedAt: Date.now(),
      unreadCounts: {
        [user._id.toString()]: 0,
        [storeOwner._id.toString()]: 0,
      },
    });

    // Add entries to userConversations for efficient querying
    await ctx.db.insert("userConversations", { userId: user._id, conversationId, updatedAt: Date.now(), isArchived: false });
    await ctx.db.insert("userConversations", { userId: storeOwner._id, conversationId, updatedAt: Date.now(), isArchived: false });

    return conversationId;
  },
});

// Query: Find or create a conversation for a specific order
export const findOrCreateConversationForOrder = mutation({
  args: {
    tokenIdentifier: v.string(),
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    const initiator = await validateToken(ctx, args.tokenIdentifier);
    const order = await ctx.db.get(args.orderId);

    if (!order) {
      throw new ConvexError("Order not found.");
    }

    const customerId = order.userId;

    // Ensure the initiator is either the store owner or the assigned driver
    const store = await ctx.db.get(order.storeId);
    const isOwner = store?.ownerId === initiator.tokenIdentifier;
    const isAssignedDriver = order.driverId === initiator._id;
    const isCustomer = order.userId === initiator._id;

    if (!isOwner && !isAssignedDriver && !isCustomer) {
      throw new ConvexError("You are not authorized to start a chat for this order.");
    }

    // Check if a conversation for this order already exists
    let conversation = await ctx.db.query("conversations").withIndex("by_order", q => q.eq("orderId", args.orderId)).first();

    if (conversation) {
      return conversation._id;
    }

    // Create a new conversation linked to the order
    const conversationId = await ctx.db.insert("conversations", {
      participants: [initiator._id, customerId].sort(),
      orderId: args.orderId,
      updatedAt: Date.now(),
      unreadCounts: {
        [initiator._id.toString()]: 0,
        [customerId.toString()]: 0,
      },
    });

    await ctx.db.insert("userConversations", { userId: initiator._id, conversationId, updatedAt: Date.now(), isArchived: false });
    await ctx.db.insert("userConversations", { userId: customerId, conversationId, updatedAt: Date.now(), isArchived: false });

    return conversationId;
  },
});

// Mutation: Find or create a direct conversation between two users
export const findOrCreateDirectConversation = mutation({
  args: {
    tokenIdentifier: v.string(),
    otherUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier); // The initiator (e.g., store owner)

    const otherUser = await ctx.db.get(args.otherUserId);
    if (!otherUser) {
      throw new ConvexError("The other user does not exist.");
    }

    if (user._id === otherUser._id) {
      throw new ConvexError("Cannot create a conversation with yourself.");
    }

    const participants = [user._id, otherUser._id].sort();

    // Check if a direct conversation (not tied to an order) already exists
    const existingConversation = await ctx.db
      .query("conversations")
      .withIndex("by_user_and_updated_at", (q) => q.eq("participants", participants))
      .filter(q => q.eq(q.field("orderId"), undefined))
      .first();

    if (existingConversation) {
      return existingConversation._id;
    }

    const conversationId = await ctx.db.insert("conversations", {
      participants,
      updatedAt: Date.now(),
      unreadCounts: { [user._id.toString()]: 0, [otherUser._id.toString()]: 0 },
    });

    await ctx.db.insert("userConversations", { userId: user._id, conversationId, updatedAt: Date.now(), isArchived: false });
    await ctx.db.insert("userConversations", { userId: otherUser._id, conversationId, updatedAt: Date.now(), isArchived: false });

    return conversationId;
  },
});

// Query: Get a user's conversations, ordered by last update
export const getConversations = query({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);

    // OPTIMIZED: Fetch only the user's conversations using the new table
    const userConvs = await ctx.db
      .query("userConversations")
      .withIndex("by_user_archived_updated", (q) => q.eq("userId", user._id).eq("isArchived", false))
      .order("desc")
      .take(50); // Pagination limit

    const blockedUserIds = new Set(user.blockedUsers ?? []);

    // Deduplicate conversation IDs to prevent duplicate entries in the list
    const uniqueConversationIds = [...new Set(userConvs.map(uc => uc.conversationId))];

    // Fetch the actual conversation documents
    const conversations = (await Promise.all(uniqueConversationIds.map(id => ctx.db.get(id)))).filter((c): c is Doc<"conversations"> => c !== null);

    const conversationsWithDetails = await Promise.all(conversations.map(async (conv) => {
      const otherUserId = conv.participants.find((id) => id !== user._id) ?? user._id;

      if (!otherUserId) return null;

      // Fetch all related data in parallel for better performance
      const [otherUser, otherUserProfile, report] = await Promise.all([
        ctx.db.get(otherUserId),
        ctx.db.query("userProfiles").withIndex("by_user", (q) => q.eq("userId", otherUserId)).unique(),
        conv.orderId ? ctx.db.query("reports").withIndex("by_order", q => q.eq("orderId", conv.orderId!)).first() : null
      ]);
      
      const profileImageUrl = otherUserProfile?.profileImageId
        ? await ctx.storage.getUrl(otherUserProfile.profileImageId)
        : null;

      return {
        ...conv,
        otherUserName: [otherUserProfile?.firstName, otherUserProfile?.lastName].filter(Boolean).join(' ') || 
                       otherUser?.name || 
                       "Unknown User",
        otherUserId: otherUserId,
        otherUserAvatar: profileImageUrl,
        unreadCount: conv.unreadCounts[user._id] ?? 0,
        lastMessage: conv.lastMessage || "",
        isDisputeConversation: !!report,
        disputeStatus: report?.status,
      };
    }));

    return conversationsWithDetails.filter((c): c is NonNullable<typeof c> => c !== null);
  },
});

// Query: Get details for a specific conversation, including other user's info
export const getConversationDetails = query({
  args: { tokenIdentifier: v.string(), conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    const conversation = await ctx.db.get(args.conversationId);

    if (!conversation || !conversation.participants.includes(user._id)) {
      throw new Error("Conversation not found or access denied.");
    }

    // Find the other user's ID. If it's a chat with oneself, otherUserId will be the same as user._id.
    const otherUserId = conversation.participants.find((id) => id !== user._id) ?? user._id;
    const otherUser = await ctx.db.get(otherUserId);
    const otherUserProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", otherUserId))
      .unique();

    const presence = await ctx.db
      .query("presence")
      .withIndex("by_user", (q) => q.eq("userId", otherUserId))
      .unique();

    const profileImageUrl = otherUserProfile?.profileImageId
      ? await ctx.storage.getUrl(otherUserProfile.profileImageId)
      : null;

    const isOnline = presence ? Date.now() - presence.lastSeen < 30000 : false; // 30 second threshold

    return {
      ...conversation,
      otherUserName: [otherUserProfile?.firstName, otherUserProfile?.lastName].filter(Boolean).join(' ') || 
                     otherUser?.name || 
                     "Unknown User",
      otherUserAvatar: profileImageUrl,
      otherUserId: otherUserId,
      isOnline,
      lastSeen: presence?.lastSeen,
    };
  },
});

// Query: Get messages for a specific conversation
export const getMessages = query({
  args: {
    tokenIdentifier: v.string(),
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    const conversation = await ctx.db.get(args.conversationId);

    if (!conversation || !conversation.participants.includes(user._id)) {
      throw new Error("Conversation not found or access denied.");
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation_created", (q) => q.eq("conversationId", args.conversationId))
      .filter((q) => q.eq(q.field("isDeleted"), false))
      .order("desc") // OPTIMIZATION: Get the *newest* 100 messages first
      .take(100);

    // Reverse messages to show them in chronological order (oldest -> newest) and add image URLs
    return Promise.all(
      messages.reverse().map(async (message) => {
        if (message.type === "image" && message.imageIds && message.imageIds.length > 0) {
          const imageUrls = await Promise.all(
            message.imageIds.map((id) => ctx.storage.getUrl(id))
          );
          return { ...message, imageUrls };
        }
        return message;
      })
    );
  },
});

// Mutation: Send a new message
export const sendMessage = mutation({
  args: {
    tokenIdentifier: v.string(),
    conversationId: v.id("conversations"),
    text: v.string(),
    imageIds: v.optional(v.array(v.id("_storage"))),
    repliedToMessageId: v.optional(v.id("messages")),    
  },
  handler: async (ctx, args) => {
    const sender = await validateToken(ctx, args.tokenIdentifier);
    const conversation = await ctx.db.get(args.conversationId);

    if (!conversation || !conversation.participants.includes(sender._id)) {
      throw new Error("Conversation not found or access denied.");
    }

    // Prevent sending messages to archived conversations
    if (conversation.isArchived) {
      throw new ConvexError("This conversation is archived and cannot receive new messages.");
    }

    const otherUserId = conversation.participants.find(id => id !== sender._id)!;

    let repliedToMessageText: string | undefined;
    let repliedToMessageSender: string | undefined;

    if (args.repliedToMessageId) {
      const repliedToMessage = await ctx.db.get(args.repliedToMessageId);
      if (repliedToMessage && repliedToMessage.conversationId === args.conversationId) {
        const senderOfRepliedMessage = await ctx.db.get(repliedToMessage.senderId);
        repliedToMessageText = repliedToMessage.text;
        const senderProfile = await ctx.db.query("userProfiles").withIndex("by_user", q => q.eq("userId", repliedToMessage.senderId)).unique();
        repliedToMessageSender = 
          [senderProfile?.firstName, senderProfile?.lastName].filter(Boolean).join(' ') ||
          senderOfRepliedMessage?.name ||
          "Unknown User";
      }
    }

    // إضافة: أدرج createdAt
    await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId: sender._id,
      text: args.text,
      type: args.imageIds && args.imageIds.length > 0 ? "image" : "text",
      imageIds: args.imageIds,
      status: "sent",
      isDeleted: false,
      createdAt: Date.now(), // إضافة جديدة
      repliedToMessageId: args.repliedToMessageId,
      repliedToMessageText: repliedToMessageText,
      repliedToMessageSender: repliedToMessageSender,
    });

    const newUnreadCounts = {
      ...conversation.unreadCounts,
      [otherUserId]: (conversation.unreadCounts[otherUserId] ?? 0) + 1,
    };

    await ctx.db.patch(args.conversationId, {
      lastMessage: args.text,
      lastMessageSenderId: sender._id,
      updatedAt: Date.now(),
      unreadCounts: newUnreadCounts,
    });

    // Update updatedAt in userConversations for all participants to bring chat to top
    const userConvs = await ctx.db.query("userConversations").withIndex("by_conversation", q => q.eq("conversationId", args.conversationId)).collect();
    for (const uc of userConvs) {
      await ctx.db.patch(uc._id, { updatedAt: Date.now(), isArchived: false });
    }
  },
});

// Mutation: Mark messages in a conversation as read
export const markAsRead = mutation({
  args: {
    tokenIdentifier: v.string(),
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) return;

    await ctx.db.patch(args.conversationId, {
      unreadCounts: { ...conversation.unreadCounts, [user._id]: 0 },
    });
  },
});

// Mutation: Update user's typing status in a conversation
export const updateTypingStatus = mutation({
  args: {
    tokenIdentifier: v.string(),
    conversationId: v.id("conversations"),
    typing: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    const conversation = await ctx.db.get(args.conversationId);

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    let currentTypingStatus = conversation.typingStatus || {};

    if (args.typing) {
      // Set the user's typing status with the current timestamp
      currentTypingStatus[user._id] = Date.now();
    } else {
      // Remove the user's typing status
      delete currentTypingStatus[user._id];
    }

    await ctx.db.patch(args.conversationId, { typingStatus: currentTypingStatus });
  },
});

export const editMessage = mutation({
  args: {
    tokenIdentifier: v.string(),
    messageId: v.id("messages"),
    newText: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    const message = await ctx.db.get(args.messageId);

    if (!message || message.senderId !== user._id) {
      throw new ConvexError("You are not authorized to edit this message.");
    }

    // Optional: Add a time limit for editing, e.g., 5 minutes
    if (Date.now() - message.createdAt > 5 * 60 * 1000) {
      throw new ConvexError("You can no longer edit this message.");
    }

    await ctx.db.patch(args.messageId, { text: args.newText });
  },
});

export const deleteMessages = mutation({
  args: {
    tokenIdentifier: v.string(),
    messageIds: v.array(v.id("messages")),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    for (const messageId of args.messageIds) {
      const message = await ctx.db.get(messageId);
      // Security check: only the sender can delete their own messages
      if (message && message.senderId === user._id) {
        // Soft delete for better user experience
        await ctx.db.patch(messageId, { isDeleted: true, text: "This message was deleted" });
        const conversation = await ctx.db.get(message.conversationId);
        if (conversation?.isArchived) {
          throw new ConvexError("Cannot delete messages from an archived conversation.");
        }
        // Optional: Add a time limit for editing, e.g., 5 minutes
        if (Date.now() - message.createdAt > 5 * 60 * 1000) {
          throw new ConvexError("You can no longer edit this message.");
        }
      }
    }
  },
});


export const registerPushToken = mutation({
  args: {
    tokenIdentifier: v.string(),
    subscription: v.any(), // This will be the PushSubscription object
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);

    // Find if a token already exists for this user
    const existingToken = await ctx.db
      .query("pushTokens")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (existingToken) {
      // If the subscription is different, update it
      if (JSON.stringify(existingToken.subscription) !== JSON.stringify(args.subscription)) {
        await ctx.db.patch(existingToken._id, { subscription: args.subscription });
      }
    } else {
      // Otherwise, create a new one
      await ctx.db.insert("pushTokens", { userId: user._id, subscription: args.subscription });
    }
  },
});

// Mutation: Delete one or multiple conversations
export const deleteConversations = mutation({
  args: {
    tokenIdentifier: v.string(),
    conversationIds: v.array(v.id("conversations")),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    for (const convId of args.conversationIds) {
      const conversation = await ctx.db.get(convId);
      if (!conversation || !conversation.participants.includes(user._id)) {
        throw new Error("Unauthorized to delete this conversation.");
      }
      // Delete messages first if needed
      const messages = await ctx.db.query("messages").withIndex("by_conversation_created", q => q.eq("conversationId", convId)).collect();
      await Promise.all(messages.map(msg => ctx.db.delete(msg._id)));
      await ctx.db.delete(convId);

      // Delete from userConversations
      const userConvs = await ctx.db.query("userConversations").withIndex("by_conversation", q => q.eq("conversationId", convId)).collect();
      await Promise.all(userConvs.map(uc => ctx.db.delete(uc._id)));
    }
  },
});

// Mutation: Archive one or multiple conversations (set isArchived: true)
export const archiveConversations = mutation({
  args: {
    tokenIdentifier: v.string(),
    conversationIds: v.array(v.id("conversations")),
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    for (const convId of args.conversationIds) {
      const conversation = await ctx.db.get(convId);
      if (!conversation || !conversation.participants.includes(user._id)) {
        throw new Error("Unauthorized to archive this conversation.");
      }
      await ctx.db.patch(convId, { isArchived: true });
      
      // Update userConversations
      const userConvs = await ctx.db.query("userConversations").withIndex("by_conversation", q => q.eq("conversationId", convId)).collect();
      await Promise.all(userConvs.map(uc => ctx.db.patch(uc._id, { isArchived: true })));
    }
  },
});

// Mutation: Block one or multiple users (add to blockedUsers array in user's doc)
export const blockUsers = mutation({
  args: {
    tokenIdentifier: v.string(),
    userIds: v.array(v.id("users")), // IDs of other users to block
  },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    const userDoc = await ctx.db.get(user._id);
    if (!userDoc) throw new Error("User not found.");
    
    const existingBlocked = userDoc.blockedUsers ?? [];
    const newBlockedSet = new Set([...existingBlocked, ...args.userIds]);
    
    // Prevent user from blocking themselves
    newBlockedSet.delete(user._id);

    await ctx.db.patch(user._id, { blockedUsers: Array.from(newBlockedSet) }); // Avoid duplicates
  },
});

// Query: Get a user's archived conversations
export const getArchivedConversations = query({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);

    const userConvs = await ctx.db
      .query("userConversations")
      .withIndex("by_user_archived_updated", (q) => q.eq("userId", user._id).eq("isArchived", true))
      .order("desc")
      .take(50);

    // Deduplicate conversation IDs
    const uniqueConversationIds = [...new Set(userConvs.map(uc => uc.conversationId))];

    const archivedConversations = (await Promise.all(uniqueConversationIds.map(id => ctx.db.get(id)))).filter((c): c is Doc<"conversations"> => c !== null);

    const conversationsWithDetails = await Promise.all(archivedConversations.map(async (conv) => {
      const otherUserId = conv.participants.find((id) => id !== user._id) ?? user._id;
      
      const [otherUser, otherUserProfile, report] = await Promise.all([
        ctx.db.get(otherUserId),
        ctx.db.query("userProfiles").withIndex("by_user", (q) => q.eq("userId", otherUserId)).unique(),
        conv.orderId ? ctx.db.query("reports").withIndex("by_order", q => q.eq("orderId", conv.orderId!)).first() : null
      ]);
      
      const profileImageUrl = otherUserProfile?.profileImageId
        ? await ctx.storage.getUrl(otherUserProfile.profileImageId)
        : null;
      

      return {
        ...conv,
        otherUserName: otherUser?.name ?? "Unknown User",
        otherUserAvatar: profileImageUrl,
        unreadCount: conv.unreadCounts[user._id] ?? 0,
        isDisputeConversation: !!report,
        disputeStatus: report?.status,
      };
    }));

    return conversationsWithDetails;
  },
});

// Query: Get a user's blocked users list with details
export const getBlockedUsers = query({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    const user = await validateToken(ctx, args.tokenIdentifier);
    if (!user.blockedUsers || user.blockedUsers.length === 0) {
      return [];
    }

    const blockedUsers = await Promise.all(
      user.blockedUsers.map(async (userId) => {
        const blockedUser = await ctx.db.get(userId);
        const profile = await ctx.db.query("userProfiles").withIndex("by_user", q => q.eq("userId", userId)).unique();
        const avatar = profile?.profileImageId ? await ctx.storage.getUrl(profile.profileImageId) : null;
        return { ...blockedUser, avatar };
      })
    );
    return blockedUsers.filter((u): u is Doc<"users"> & { avatar: string | null } => u !== null);
  },
});

// Migration mutation to backfill userConversations (Run this once from dashboard)
export const migrateConversations = mutation({
  args: {},
  handler: async (ctx) => {
    const allConversations = await ctx.db.query("conversations").collect();
    let count = 0;
    for (const conv of allConversations) {
      for (const userId of conv.participants) {
        const existing = await ctx.db.query("userConversations")
          .withIndex("by_user_updated", q => q.eq("userId", userId).eq("updatedAt", conv.updatedAt))
          .filter(q => q.eq(q.field("conversationId"), conv._id))
          .first();
        if (!existing) {
          await ctx.db.insert("userConversations", { userId, conversationId: conv._id, updatedAt: conv.updatedAt, isArchived: conv.isArchived ?? false });
          count++;
        }
      }
    }
    return `Migrated ${count} user conversation entries.`;
  }
});