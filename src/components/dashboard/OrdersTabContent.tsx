import React, { useMemo, useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Doc, Id } from '../../../convex/_generated/dataModel';
import { toast } from 'sonner';
import { Skeleton } from '../ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Label } from "../ui/label";
import { Loader2, User, Truck, TicketPercent, MapPin, Package, MessageSquare, Search, Phone } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { NavigateFunction } from 'react-router-dom';
import { Input } from '../ui/input';
import { useDebounce } from '../../hooks/useDebounce';

function OrdersTabSkeleton() {
  return (
    <Card className="bg-gray-900/50 border-gray-800">
      <CardHeader>
        <CardTitle>Recent Orders</CardTitle>
        <CardDescription>Manage your restaurant's incoming orders.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border border-gray-800 rounded-lg gap-4">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-32 bg-gray-700" />
                <Skeleton className="h-4 w-48 bg-gray-700" />
              </div>
              <div className="flex items-center gap-4 w-full sm:w-auto justify-between">
                <Skeleton className="h-6 w-16 bg-gray-700" />
                <Skeleton className="h-6 w-24 rounded-full bg-gray-700" />
                <Skeleton className="h-9 w-28 bg-gray-700" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function OrderCard({
  order,
  onUpdateStatus,
  getNextActionText,
  onStartChat,
  isActionable,
}: {
  order: Doc<"orders"> & { customerName: string; customerPhone?: string };
  onUpdateStatus: (orderId: Id<"orders">, currentStatus: Doc<"orders">["status"]) => void;
  getNextActionText: (status: Doc<"orders">["status"]) => string;
  isActionable: (status: Doc<"orders">["status"]) => boolean;
  onStartChat: (orderId: Id<"orders">) => void;
}) {
  return (
    <div key={order._id} className="bg-gray-800/50 rounded-2xl p-4 sm:p-6 border border-gray-700/60 transition-all hover:border-purple-500/30">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        {/* Left Side: Order Details */}
        <div className="flex-1 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <User className="h-4 w-4 text-gray-400" />
                <p className="font-semibold text-lg text-white">{order.customerName}</p>
              </div>
              {order.customerPhone && (
                <div className="flex items-center gap-2 mb-1 text-sm text-gray-400">
                  <Phone className="h-3 w-3" />
                  <a href={`tel:${order.customerPhone}`} className="hover:text-purple-400 transition-colors">{order.customerPhone}</a>
                </div>
              )}
              <p className="text-xs text-gray-500 font-mono ml-6">Order #{order._id.slice(-6).toUpperCase()}</p>
            </div>
            <div className="sm:hidden flex items-center gap-1">
              {order.discountAmount && order.discountAmount > 0 && (
                <span title={`Discount of ${order.discountAmount} applied`}>
                  <TicketPercent className="h-4 w-4 text-green-400" />
                </span>
              )}
              <span className="font-semibold text-lg text-purple-400 font-mono">π{order.totalAmount.toFixed(7)}</span>
            </div>
          </div>

          <div className="flex items-start gap-2 text-sm text-gray-400">
            <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p className="truncate">{order.deliveryAddress}</p>
          </div>

          <div className="border-t border-gray-700/50 pt-3">
            <div className="flex items-start gap-2 text-sm text-gray-400">
              <Package className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                {order.items.map((item, index) => (
                  <div key={index}>
                    <span className="text-gray-300">{item.quantity}x {item.name}</span>
                    {item.options && Object.values(item.options).some(v => (Array.isArray(v) ? v.length > 0 : !!v)) && (
                      <span className="text-xs text-gray-500 ml-2">({Object.values(item.options).flat().join(', ')})</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Status & Actions */}
        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-4 sm:gap-2 border-t sm:border-t-0 sm:border-l border-gray-700/50 pt-4 sm:pt-0 sm:pl-4">
          <div className="hidden sm:flex items-center gap-1">
            {order.discountAmount && order.discountAmount > 0 && <span title={`Discount of ${order.discountAmount} applied`}><TicketPercent className="h-4 w-4 text-green-400" /></span>}
            <span className="font-semibold text-lg text-purple-400 font-mono">π{order.totalAmount.toFixed(7)}</span>
          </div>
          <Badge variant={order.status === 'delivered' ? 'default' : order.status === 'preparing' ? 'secondary' : order.status === 'cancelled' ? 'destructive' : 'outline'} className="capitalize text-xs h-7">{order.status.replace(/_/g, ' ')}</Badge>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button size="sm" variant="outline" onClick={() => onStartChat(order._id)} className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10 hover:text-purple-300 w-full sm:w-auto">
              <MessageSquare className="h-4 w-4 mr-2" />
              Chat
            </Button>
            <Button size="sm" onClick={() => onUpdateStatus(order._id, order.status)} disabled={!isActionable(order.status)} className="bg-purple-600 hover:bg-purple-700 text-white disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed w-full sm:w-auto">{getNextActionText(order.status)}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function OrdersTabContent({ storeId, onNavigateToChat }: { storeId: Id<"stores">, onNavigateToChat: (conversationId: Id<"conversations">) => void }) {
  const { sessionToken } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300); // Debounce input by 300ms
  const recentOrders = useQuery(
    api.orders.getRecentOrdersByStore,
    sessionToken ? { storeId, tokenIdentifier: sessionToken, searchTerm: debouncedSearchTerm } : "skip"
  );
  const drivers = useQuery(
    api.drivers.getDriversForStore,
    sessionToken ? { storeId, tokenIdentifier: sessionToken } : "skip"
  );
  const [isAssignDriverOpen, setIsAssignDriverOpen] = React.useState(false);
  const [orderToDispatch, setOrderToDispatch] = React.useState<Id<"orders"> | null>(null);
  const [selectedDriverId, setSelectedDriverId] = React.useState<Id<"users"> | null>(null);

  const updateOrderStatus = useMutation(api.orders.updateOrderStatus);
  const findOrCreateChat = useMutation(api.chat.findOrCreateConversationForOrder);

  const handleUpdateStatus = async (orderId: Id<"orders">, currentStatus: Doc<"orders">["status"]) => {
    let nextStatus: Doc<"orders">["status"] | '' = '';
    switch (currentStatus) {
      case 'confirmed':
        nextStatus = 'preparing';
        break;
      case 'preparing':
        // Instead of directly changing status, open the driver assignment dialog
        setOrderToDispatch(orderId);
        setIsAssignDriverOpen(true);
        nextStatus = 'out_for_delivery';
        break;
      case 'out_for_delivery':
        nextStatus = 'delivered';
        break;
      default:
        return; // No action for other statuses
    }
    if (!sessionToken) {
      toast.error("Authentication error. Please log in again.");
      return;
    }

    // If the next step is not dispatching, update status directly.
    if (nextStatus !== 'out_for_delivery') {
      try {
        await updateOrderStatus({ orderId, status: nextStatus, tokenIdentifier: sessionToken });
        toast.success(`Order status updated to "${nextStatus.replace(/_/g, ' ')}"`);
      } catch (error: any) {
        toast.error('Failed to update order status.', { description: error.data?.message });
      }
    }
  };

  const handleConfirmDispatch = async () => {
    if (!orderToDispatch || !selectedDriverId || !sessionToken) {
      toast.error("Please select a driver to dispatch the order.");
      return;
    }

    try {
      await updateOrderStatus({
        orderId: orderToDispatch,
        status: 'out_for_delivery',
        driverId: selectedDriverId,
        tokenIdentifier: sessionToken,
      });
      toast.success("Order dispatched successfully!");
    } catch (error: any) {
      toast.error("Failed to dispatch order.", { description: error.data?.message });
    } finally {
      setIsAssignDriverOpen(false);
      setOrderToDispatch(null);
      setSelectedDriverId(null);
    }
  };

  const handleStartChat = async (orderId: Id<"orders">) => {
    if (!sessionToken) {
      toast.error("Authentication error. Please log in again.");
      return;
    }
    try {
      const conversationId = await findOrCreateChat({ orderId, tokenIdentifier: sessionToken });
      onNavigateToChat(conversationId);
    } catch (error: any) {
      toast.error("Failed to start chat.", {
        description: error.data?.message || "An unexpected error occurred.",
      });
      console.error("Chat creation error:", error);
    }
  };

  const getNextActionText = (status: Doc<"orders">["status"]) => {
    switch (status) {
      case 'confirmed':
        return 'Start Preparing';
      case 'preparing':
        return 'Dispatch Order';
      case 'out_for_delivery':
        return 'Mark Delivered';
      default:
        return 'Update';
    }
  };

  const isActionable = (status: Doc<"orders">["status"]) => {
    return ['confirmed', 'preparing', 'out_for_delivery'].includes(status);
  };

  if (recentOrders === undefined) {
    return <OrdersTabSkeleton />;
  }

  return (
    <>
      <CardHeader className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <CardTitle>Recent Orders</CardTitle>
            <CardDescription>Manage your restaurant's incoming orders.</CardDescription>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name or order ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 w-full bg-gray-800/60 border-gray-700 focus:ring-purple-500" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {recentOrders.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <p className="text-lg">No recent orders found.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {recentOrders.map((order) => (
              <OrderCard key={order._id} order={order} onUpdateStatus={handleUpdateStatus} onStartChat={handleStartChat} getNextActionText={getNextActionText} isActionable={isActionable} />
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={isAssignDriverOpen} onOpenChange={setIsAssignDriverOpen}>
        <DialogContent className="sm:max-w-[425px] bg-gray-900/90 border-gray-700/60 text-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Truck className="h-6 w-6 text-purple-400" />
              <span>Assign Driver</span>
            </DialogTitle>
            <DialogDescription className="text-gray-400 pt-2 pl-8">
              Select an available driver to dispatch this order.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-[50vh] overflow-y-auto">
            {drivers === undefined ? (
              <div className="flex justify-center items-center h-24"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : (
              <RadioGroup onValueChange={(value: string) => setSelectedDriverId(value as Id<"users">)}>
                <div className="space-y-2">
                  {drivers.filter(d => d.status === 'active').map(driver => {
                    // Construct the full name from the profile, falling back to the user's name
                    const fullName = [driver.profile?.firstName, driver.profile?.lastName].filter(Boolean).join(' ') || driver.name;

                    return (
                    <Label key={driver._id} htmlFor={driver._id} className="flex items-center justify-between p-3 rounded-lg border border-gray-700 has-[:checked]:border-purple-500 has-[:checked]:bg-purple-500/10 cursor-pointer transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
                          {/* FIX: Use profileImageUrl which is the correct URL string */}
                          {driver.profile?.profileImageUrl ? <img src={driver.profile.profileImageUrl} alt={fullName} className="w-full h-full object-cover rounded-full" /> : <User size={20} />}
                        </div>
                        <div>
                          {/* FIX: Display the constructed full name */}
                          <p className="font-semibold">{fullName}</p>
                          <p className="text-xs text-gray-400">{driver.profile?.piUsername ? `@${driver.profile.piUsername}` : 'No Pi username'}</p>
                        </div>
                      </div>
                      <RadioGroupItem value={driver.driverId} id={driver._id} />
                    </Label>
                    );
                  })}
                </div>
              </RadioGroup>
            )}
          </div>
          <DialogFooter className="mt-4 sm:justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsAssignDriverOpen(false)} className="text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition-colors rounded-xl">Cancel</Button>
            <Button onClick={handleConfirmDispatch} disabled={!selectedDriverId} className="bg-purple-600 hover:bg-purple-700 text-white transition-transform hover:scale-105 rounded-xl disabled:bg-gray-600 disabled:cursor-not-allowed">Confirm & Dispatch</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}