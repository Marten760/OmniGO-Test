import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCart, type CartItem } from "../context/CartContext";
import { Cart } from "./Cart";
import { AddReview } from "./AddReview";
import { formatPiPrice } from "../lib/utils";
import { Clock, MapPin, Star, Package, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useState, Fragment, useMemo, useEffect } from "react";
import { Doc } from "../../convex/_generated/dataModel";

function OrderCardSkeleton() {
  return (
    <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="h-6 w-40 bg-gray-700 rounded mb-2"></div>
          <div className="h-4 w-24 bg-gray-700 rounded"></div>
        </div>
        <div className="text-right">
          <div className="h-8 w-28 bg-gray-700 rounded-full"></div>
          <div className="h-4 w-20 bg-gray-700 rounded mt-2"></div>
        </div>
      </div>

      <div className="space-y-3 mb-4">
        <div className="flex justify-between">
          <div className="h-4 w-3/5 bg-gray-700 rounded"></div>
          <div className="h-4 w-1/5 bg-gray-700 rounded"></div>
        </div>
        <div className="flex justify-between">
          <div className="h-4 w-2/5 bg-gray-700 rounded"></div>
          <div className="h-4 w-1/5 bg-gray-700 rounded"></div>
        </div>
      </div>

      <div className="h-16 bg-gray-700/50 rounded-lg my-4"></div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-700 mt-4">
        <div className="h-5 w-32 bg-gray-700 rounded"></div>
        <div className="h-7 w-24 bg-gray-700 rounded"></div>
      </div>
    </div>
  );
}

export function OrdersPage() {
  const [activeTab, setActiveTab] = useState<"current" | "history">("current");
  const { items, updateQuantity, removeItem, clearCart, getTotalItems, addItem } = useCart();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const sessionToken = useMemo(() => localStorage.getItem("sessionToken"), []);
  const [reviewingOrder, setReviewingOrder] = useState<Doc<"orders"> | null>(null);
  const orders = useQuery(api.orders.getOrdersByUser, sessionToken ? { tokenIdentifier: sessionToken } : "skip");

  // Fetch all user reviews once to avoid N+1 queries inside the map.
  const userReviews = useQuery(api.reviews.getUserReviews, sessionToken ? { tokenIdentifier: sessionToken } : "skip");
  const reviewedStoreIds = useMemo(() => {
    return new Set(userReviews?.map(review => review.storeId));
  }, [userReviews]);

  const currentOrders = orders?.filter(order => 
    order.status === "confirmed" || order.status === "preparing" || order.status === "out_for_delivery"
  );
  
  const orderHistory = orders?.filter(order => 
    order.status === "delivered" || order.status === "cancelled"
  );

  // Close review modal if cart is opened
  useEffect(() => {
    if (isCartOpen && reviewingOrder) {
      setReviewingOrder(null);
    }
  }, [isCartOpen, reviewingOrder]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "preparing": return "bg-yellow-500";
      case "out_for_delivery": return "bg-blue-500";
      case "delivered": return "bg-green-500";
      case "cancelled": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  const getStatusText = (status: Doc<"orders">["status"]) => {
    switch (status) {
      case "confirmed": return "Confirmed";
      case "preparing": return "Preparing";
      case "out_for_delivery": return "Out for Delivery";
      case "delivered": return "Delivered";
      case "cancelled": return "Cancelled";
      default: return status;
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (orders === undefined) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <div className="h-8 w-48 bg-gray-700 rounded-lg mb-8 animate-pulse"></div>
        <div className="h-14 bg-gray-800 rounded-xl p-1 mb-8 animate-pulse"></div>
        <div className="space-y-4">
          <OrderCardSkeleton />
          <OrderCardSkeleton />
        </div>
      </div>
    );
  }

  const OrderStatusTracker = ({ status }: { status: Doc<"orders">["status"] }) => {
    const statuses: Doc<"orders">["status"][] = ["confirmed", "preparing", "out_for_delivery"];
    const currentStatusIndex = statuses.indexOf(status);
  
    if (currentStatusIndex === -1 || status === 'cancelled' || status === 'delivered') {
      return null;
    }
  
    return (
      <div className="w-full pt-4 mt-4">
        <div className="flex items-start justify-between">
          {statuses.map((s, index) => {
            const isActive = index <= currentStatusIndex;
            const isCurrent = index === currentStatusIndex;
            const isDone = index < currentStatusIndex;
  
            return (
              <Fragment key={s}>
                <div className="flex flex-col items-center text-center w-1/3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${isActive ? "border-purple-500 bg-purple-500/20" : "border-gray-600"}`}>
                    {isDone ? (
                      <Check className="w-5 h-5 text-purple-400" />
                    ) : (
                      <div className={`w-3 h-3 rounded-full transition-all duration-300 ${isCurrent ? "bg-purple-400 animate-pulse" : "bg-gray-500"}`}></div>
                    )}
                  </div>
                  <p className={`text-xs mt-2 transition-colors duration-300 ${isActive ? 'text-white' : 'text-gray-400'}`}>{getStatusText(s)}</p>
                </div>
                {index < statuses.length - 1 && (
                  <div className={`flex-1 h-0.5 mt-4 rounded-full transition-all duration-500 ${isDone ? 'bg-purple-500' : 'bg-gray-600'}`}></div>
                )}
              </Fragment>
            );
          })}
        </div>
      </div>
    );
  };

  const handleReorder = (order: Doc<"orders">) => {
    // 1. Clear the current cart
    clearCart();

    // 2. Add items from the old order to the cart
    order.items.forEach((item, index) => {
      const cartItem: CartItem = {
        id: item.productId, // The addItem function in context expects the product ID
        productId: item.productId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        storeId: order.storeId,
        imageUrl: item.imageUrl ?? undefined, // Handle cases where imageUrl might not exist on old orders
        options: item.options ?? {}, // Handle cases where options might not exist on old orders
      };
      addItem(cartItem, true); // Add item without showing toast for each one
    });
    toast.success(`Items from order #${order._id.slice(-6).toUpperCase()} have been added to your cart.`);
    setIsCartOpen(true);
  };

  const OrderCard = ({ order }: { order: Doc<"orders"> }) => {
    const hasReviewed = reviewedStoreIds.has(order.storeId);

    return (
      <div key={order._id} className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-white">{order.storeName}</h3>
            <p className="text-sm text-gray-400 mt-1">
              Delivering to: <span className="text-gray-300 font-medium">{order.deliveryAddress}</span>
            </p>
            <p className="text-gray-400 text-sm">Order #{order._id.slice(-6).toUpperCase()}</p>
          </div>
          <div className="text-right">
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-white text-sm font-medium ${getStatusColor(order.status)}`}>
              {order.status !== 'delivered' && order.status !== 'cancelled' && <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></div>}
              {getStatusText(order.status)}
            </div>
            <p className="text-gray-400 text-sm mt-1">{formatDate(order._creationTime)}</p>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          {order.items.map((item, index) => (
            <div key={index} className="flex justify-between text-sm">
              <div className="text-gray-300">
                <span>{item.quantity}x {item.name}</span>
                {item.options && Object.values(item.options).some(v => (Array.isArray(v) ? v.length > 0 : !!v)) && (
                  <div className="text-xs text-gray-400 pl-4">
                    {Object.entries(item.options)
                      .filter(([_, value]) => (Array.isArray(value) ? value.length > 0 : !!value))
                      .map(([key, value]) => (
                        <div key={key}>
                          • {Array.isArray(value) 
                              ? value.join(', ') 
                              : (typeof value === 'string' ? value : '')}
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
              <span className="text-white font-mono">{formatPiPrice(item.price * item.quantity)}</span>
            </div>
          ))}
        </div>

        {order.discountAmount && order.discountAmount > 0 && (
          <div className="flex justify-between text-sm text-green-400 border-t border-dashed border-gray-700 pt-2 mt-2">
            <span>Discount Applied</span>
            <span className="font-mono">-{formatPiPrice(order.discountAmount)}</span>
          </div>
        )}
        <OrderStatusTracker status={order.status} />

        <div className="flex items-center justify-between pt-4 border-t border-gray-700 mt-4">
          {order.status === 'delivered' || order.status === 'cancelled' ? (
            <div className="flex items-center space-x-4">
              {order.status === 'delivered' && !hasReviewed && (
                <button onClick={() => setReviewingOrder(order)} className="flex items-center space-x-2 text-purple-400 hover:text-purple-300 transition-colors">
                  <Star size={16} />
                  <span className="text-sm">Rate Order</span>
                </button>
              )}
              <button 
                onClick={() => handleReorder(order)}
                className="text-gray-400 hover:text-white transition-colors text-sm"
              >
                Reorder
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-4 text-gray-400 text-sm">
              <div className="flex items-center space-x-1">
                <Clock size={16} />
                <span>{order.estimatedDeliveryTime}</span>
              </div>
            </div>
          )}
          <div className="text-lg sm:text-xl font-bold text-white font-mono">
            {formatPiPrice(order.totalAmount)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div>
        <h1 className="text-3xl font-bold mb-8">Your Orders</h1>

        {/* Cart Section */}
        {getTotalItems() > 0 && (
          <div className="mb-8 bg-gray-800 border border-gray-700 rounded-2xl p-4 animate-fade-in">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-600/20 rounded-full flex items-center justify-center border-2 border-purple-500/30">
                  <Package size={24} className="text-purple-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">You have items in your cart</h3>
                  <p className="text-sm text-gray-400">{getTotalItems()} items ready to order</p>
                </div>
              </div>
              <button onClick={() => setIsCartOpen(true)} className="bg-purple-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-purple-700 transition-colors shadow-lg hover:scale-105 active:scale-100">
                View Cart
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex space-x-1 bg-gray-800 rounded-xl p-1 mb-8">
          <button
            onClick={() => setActiveTab("current")}            className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all duration-200 ${
              activeTab === "current"
                ? "bg-purple-600 text-white shadow-lg"
                : "text-gray-400 hover:text-white transition-transform hover:scale-105"
            }`}
          >
            Current Orders ({currentOrders?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("history")}            className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all duration-200 ${
              activeTab === "history"
                ? "bg-purple-600 text-white shadow-lg"
                : "text-gray-400 hover:text-white transition-transform hover:scale-105"
            }`}
          >
            Order History ({orderHistory?.length || 0})
          </button>
        </div>

        {/* Orders List */}
        <div className="space-y-4">
          {activeTab === "current" && (
            <>
              {currentOrders && currentOrders.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-6xl mb-4">📦</div>
                  <h3 className="text-xl font-semibold text-white mb-2">No current orders</h3>
                  <p className="text-gray-400">Your active orders will appear here</p>
                </div>
              ) : (
                currentOrders?.map((order) => <OrderCard key={order._id} order={order} />)
              )}
            </>
          )}

          {activeTab === "history" && (
            <>
              {orderHistory && orderHistory.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-6xl mb-4">📋</div>
                  <h3 className="text-xl font-semibold text-white mb-2">No order history</h3>
                  <p className="text-gray-400">Your completed orders will appear here</p>
                </div>
              ) : (
                orderHistory?.map((order) => <OrderCard key={order._id} order={order} />)
              )}
            </>
          )}
        </div>
      </div>

      <Cart
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={items}
        onUpdateQuantity={updateQuantity}
        onRemoveItem={removeItem}
        onClearCart={clearCart}
      />

      {/* Review Modal */}
      {reviewingOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-gray-800 w-full max-w-lg rounded-2xl border border-gray-700 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white">Rate your order from {reviewingOrder.storeName}</h3>
              <button onClick={() => setReviewingOrder(null)} className="p-2 rounded-full hover:bg-gray-700 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto">
              <AddReview storeId={reviewingOrder.storeId} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}