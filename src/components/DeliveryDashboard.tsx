import React, { useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../hooks/useAuth';
import { Doc, Id } from '../../convex/_generated/dataModel';
import { useNavigate, NavigateFunction } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, Truck, Check, MapPin, Phone, MessageSquare } from 'lucide-react';
import { formatPiPrice } from '../lib/utils';
function DeliveryOrderCard({ order, onNavigateToChat }: { order: Doc<"orders"> & { customerPhone?: string }, onNavigateToChat: (conversationId: Id<"conversations">) => void }) {
  const { sessionToken } = useAuth();
  const updateStatus = useMutation(api.orders.updateOrderStatus);

  const handleMarkDelivered = async () => {
    if (!sessionToken) {
      toast.error("Authentication error.");
      return;
    }
    const promise = updateStatus({
      tokenIdentifier: sessionToken,
      orderId: order._id,
      status: 'delivered',
    });

    toast.promise(promise, {
      loading: 'Updating status...',
      success: 'Order marked as delivered!',
      error: (err) => `Failed to update: ${err.message}`,
    });
  };

  const findOrCreateChat = useMutation(api.chat.findOrCreateConversationForOrder);

  const handleStartChat = async () => {
    if (!sessionToken) {
      toast.error("Authentication error.");
      return;
    }
    try {
      const conversationId = await findOrCreateChat({ orderId: order._id, tokenIdentifier: sessionToken });
      onNavigateToChat(conversationId);
    } catch (error: any) {
      toast.error("Failed to start chat.", {
        description: error.data?.message || "An unexpected error occurred.",
      });
    }
  };

  return (
    <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-xl font-bold text-white">{order.customerName}</h3>
          <p className="text-sm text-gray-400">Order #{order._id.slice(-6).toUpperCase()}</p>
          {order.customerPhone && (
            <div className="flex items-center gap-2 mt-1 text-sm text-gray-400">
              <Phone className="h-3 w-3" />
              <a href={`tel:${order.customerPhone}`} className="hover:text-purple-400 transition-colors">{order.customerPhone}</a>
            </div>
          )}
        </div>
        <div className="text-lg font-bold text-purple-400 font-mono">
          {formatPiPrice(order.totalAmount)}
        </div>
      </div>

      <div className="border-t border-b border-gray-700 py-4 space-y-3">
        <div className="flex items-start gap-3 text-gray-300">
          <MapPin className="w-5 h-5 text-gray-500 mt-1 flex-shrink-0" />
          <div>
            <p className="font-semibold">Delivery Address</p>
            <p>{order.deliveryAddress}</p>
          </div>
        </div>
        {order.customerNotes && (
          <div className="flex items-start gap-3 text-gray-300">
            <Phone className="w-5 h-5 text-gray-500 mt-1 flex-shrink-0" />
            <div>
              <p className="font-semibold">Customer Notes</p>
              <p>{order.customerNotes}</p>
            </div>
          </div>
        )}
      </div>

      <div>
        <h4 className="font-semibold text-gray-200 mb-2">Items</h4>
        <div className="space-y-2">
          {order.items.map((item, index) => (
            <div key={index} className="flex justify-between text-sm text-gray-400">
              <span>{item.quantity}x {item.name}</span>
              <span className="font-mono">{formatPiPrice(item.price * item.quantity)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 pt-2">
        <button
          onClick={handleStartChat}
          className="w-full bg-gray-700 text-gray-200 font-semibold py-3 rounded-xl hover:bg-gray-600 transition-all duration-200 flex items-center justify-center gap-2"
        >
          <MessageSquare size={20} />
          Chat with Customer
        </button>
        <button
          onClick={handleMarkDelivered}
          className="w-full bg-gradient-to-r from-green-500 to-teal-500 text-white font-semibold py-3 rounded-xl hover:from-green-600 hover:to-teal-600 transition-all duration-200 shadow-lg hover:scale-105 flex items-center justify-center gap-2"
        >
          <Check size={20} />
          Mark as Delivered
        </button>
      </div>
    </div>
  );
}

export function DeliveryDashboard({ onNavigateToChat, navigate }: { onNavigateToChat: (conversationId: Id<"conversations">) => void, navigate: NavigateFunction }) {
  const { sessionToken } = useAuth();
  const data = useQuery(
    api.delivery.getAssignedOrders,
    sessionToken ? { tokenIdentifier: sessionToken } : "skip"
  );

  const assignedStores = data?.assignedStores;
  const assignedOrders = data?.orders;

  if (data === undefined) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 text-purple-400 animate-spin" />
        <p className="mt-4 text-gray-400">Loading your delivery tasks...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Delivery Dashboard</h1>
        <p className="text-gray-400 mt-1">
          You are assigned to {assignedStores?.length ?? 0} store(s).
        </p>
      </div>

      {assignedOrders && assignedOrders.length > 0 ? (
        <div className="space-y-6">
          {assignedOrders.map(order => (
            <DeliveryOrderCard key={order._id} order={order} onNavigateToChat={onNavigateToChat} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-gray-800/50 border border-dashed border-gray-700 rounded-2xl">
          <Truck size={48} className="mx-auto text-gray-600 mb-4" />
          <h3 className="text-2xl font-bold text-white mb-2">All Clear!</h3>
          <p className="text-gray-400">You have no active deliveries right now.</p>
        </div>
      )}
    </div>
  );
}