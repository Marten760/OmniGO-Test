import { useState, useMemo, useEffect } from 'react';
import { PiPayment } from './PiPayment';
import { toast } from 'sonner';
import { Button } from "./ui/button";
import type { CartItem } from '../context/CartContext'; export type { CartItem };
import { X, Trash2, ShoppingCart, XCircle, AlertTriangle, Check } from 'lucide-react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';import { ChevronDown, ChevronUp } from 'lucide-react';import { motion, AnimatePresence } from 'framer-motion';
import { Id } from '../../convex/_generated/dataModel';
import { DiscountCodeInput } from './DiscountCodeInput';
import { formatPiPrice } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "./ui/command";
import { usePi } from '../hooks/usePi';  // Add this to directly access isInitialized/user for logs

// Define a type for the successful discount object from the backend
type AppliedDiscountDetails = {
  id: Id<'discounts'>;
  type: 'percentage' | 'fixed';
  value: number;
};

type AppliedDiscount = {
  code: string;
  details: AppliedDiscountDetails;
};

interface CartProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemoveItem: (id: string) => void;
  onClearCart: () => void;
}

export function Cart({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
}: CartProps) {
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState<AppliedDiscount | null>(null);
  const [showSummaryDetails, setShowSummaryDetails] = useState(true); // State to toggle summary details
  const [isAddressPopoverOpen, setIsAddressPopoverOpen] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const { sessionToken, user: authUser } = useAuth();
  const { isInitialized, user: piUser } = usePi();  // Add this for logs

  const user = useQuery(api.auth.getUserFromToken, sessionToken ? { tokenIdentifier: sessionToken } : "skip");

  const addressesData = useQuery(
    api.addresses.getUserAddresses,
    sessionToken ? { tokenIdentifier: sessionToken } : "skip"
  );

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
    [items]
  );

  const storeId = useMemo(() => {
    // This ensures that the storeId only changes when the first item in the cart changes,
    // not on every quantity update.
    const id = items[0]?.storeId;
    console.log('[Cart] Computed storeId:', id ? id : 'NULL/UNDEFINED');  // Log for diagnostics
    if (!id) console.warn('[Cart] storeId is missing! Check CartItem addition.');
    return id;
  }, [items[0]?.storeId]);

  const validationResult = useQuery(
    api.marketing.validateDiscountCode,
    submittedCode && storeId ? { storeId: storeId as Id<"stores">, code: submittedCode, orderTotal: subtotal } : 'skip'
  );

  const addAddress = useMutation(api.addresses.addAddress);

  const store = useQuery(
    api.stores.getStoreById,
    storeId ? { storeId: storeId as Id<"stores"> } : 'skip'
  );

  // New mutation for inventory validation
  const validateInventory = useMutation(api.cart.validateCartInventory);
  const [inventoryIssues, setInventoryIssues] = useState<any[]>([]);
  const [isCheckingInventory, setIsCheckingInventory] = useState(false);

  const selectedAddress = useMemo(() => 
    addressesData?.addresses.find(a => a._id === selectedAddressId),
    [addressesData, selectedAddressId]
  );

  // Calculate dynamic delivery fee based on GPS coordinates
  const dynamicDeliveryFee = useQuery(api.stores.calculateDeliveryFee, 
    storeId && selectedAddress && selectedAddress.latitude !== undefined && selectedAddress.longitude !== undefined
      ? { 
          storeId: storeId as Id<"stores">, 
          userLatitude: selectedAddress.latitude, 
          userLongitude: selectedAddress.longitude
        } 
      : "skip"
  );

  const deliveryFee = useMemo(() => {
    if (subtotal === 0) return 0;
    // useQuery returns undefined while loading. Fallback to 0.
    if (store === undefined) {
      console.log('[Cart] Store loading, deliveryFee fallback to 0');  // Log
      return 0;
    }
    
    // If we have a dynamic fee calculated from GPS, use it
    if (dynamicDeliveryFee !== undefined && dynamicDeliveryFee !== null) {
        return dynamicDeliveryFee;
    }

    // If store is not found or doesn't have delivery, fee is 0.
    if (store === null || !store.hasDelivery) return 0;
    // Fallback to 0 if dynamic fee is not available (e.g. no location set yet)
    return 0;
  }, [subtotal, store, dynamicDeliveryFee]);

  const deliveryValidation = useMemo(() => {
    if (!sessionToken) return { allowed: false, reason: "Please log in to checkout." };
    
    // If addresses are loaded but none selected (and we have some), prompt selection
    if (addressesData?.addresses && addressesData.addresses.length > 0 && !selectedAddress) {
         return { allowed: false, reason: "Please select a delivery address." };
    }
    
    // If user has no addresses
    if (addressesData?.addresses && addressesData.addresses.length === 0) {
         return { allowed: false, reason: "No saved addresses. Please add one in your account." };
    }

    const country = selectedAddress?.country || user?.profile?.country;
    const city = selectedAddress?.city || user?.profile?.city;

    if (!country || !city) {
        return { allowed: false, reason: "Missing location data. Please select a valid address." };
    }

    if (!store) return { allowed: false, reason: "Loading store info..." };

    if (store.hasDelivery) {
        if (store.country !== country) {
             return { allowed: false, reason: `Store only delivers to ${store.country}.` };
        }
        if (store.deliveryRegions && store.deliveryRegions.length > 0) {
             const isAllowList = store.isDeliveryRegionsAllowList ?? true;
             const inList = store.deliveryRegions.includes(city);
             const allowed = isAllowList ? inList : !inList;
             if (!allowed) return { allowed: false, reason: `No delivery to ${city}.` };
        }
    }
    return { allowed: true };
  }, [user, store, sessionToken, selectedAddress, addressesData]);

  // Effect to set the default address when the cart is opened or addresses are loaded
  useEffect(() => {
    if (addressesData?.addresses && addressesData.addresses.length > 0 && !selectedAddressId) {
      const defaultAddress = addressesData.defaultAddressId
        ? addressesData.addresses.find(a => a._id === addressesData.defaultAddressId)
        : addressesData.addresses[0];
      
      if (defaultAddress) {
        setSelectedAddressId(defaultAddress._id);
        setDeliveryAddress(`${defaultAddress.address}, ${defaultAddress.city}, ${defaultAddress.country}`);
      }
    }
  }, [addressesData, isOpen, selectedAddressId]);

  useEffect(() => {
    if (submittedCode && validationResult) {
      setIsLoading(false);
      if (validationResult.isValid && validationResult.discount) {
        const discountAmount = validationResult.discount.type === 'fixed' ? validationResult.discount.value : (subtotal * validationResult.discount.value) / 100;
        toast.success(`Discount applied: -${formatPiPrice(Math.min(discountAmount, subtotal))}`);
        setAppliedDiscount({ code: submittedCode.toUpperCase(), details: validationResult.discount });
      } else {
        toast.error(validationResult.message || "Invalid discount code.");
        setAppliedDiscount(null);
      }
      setSubmittedCode(null); // Reset after validation
    }
  }, [validationResult, submittedCode, subtotal]);

  const handleApplyCode = async (code: string) => {
    setIsLoading(true);
    // Trigger the useQuery by setting the code
    setSubmittedCode(code);
  };

  const handleRemoveDiscount = () => {
    setAppliedDiscount(null);
    toast.info('Discount removed.');
  };

  // Effect to validate inventory when cart changes
  useEffect(() => {
    if (!sessionToken || items.length === 0 || !isOpen) {
      setInventoryIssues([]);
      return;
    }

    const checkInventory = async () => {
      setIsCheckingInventory(true);
      try {
        const result = await validateInventory({ tokenIdentifier: sessionToken });
        if (!result.isValid) {
          setInventoryIssues(result.issues);
          toast.warning("Some items in your cart have limited stock.", {
            description: "Please review your cart before proceeding.",
          });
        } else {
          setInventoryIssues([]);
        }
      } catch (error) {
        console.error("Inventory check failed:", error);
        toast.error("Could not verify item availability.");
      } finally {
        setIsCheckingInventory(false);
      }
    };

    checkInventory();
  }, [items, sessionToken, isOpen, validateInventory]);

  const discountAmount = useMemo(() => {
    if (!appliedDiscount || subtotal === 0) return 0;
    const { type, value } = appliedDiscount.details;
    if (type === 'fixed') return Math.min(value, subtotal);
    if (type === 'percentage') return (subtotal * value) / 100;
    return 0;
  }, [appliedDiscount, subtotal]);

  const total = subtotal > 0 ? subtotal - discountAmount + (deliveryFee ?? 0) : 0;

  const handlePaymentSuccess = (paymentId: string, txid: string) => {
    console.log('Order payment successful:', { paymentId, txid });
    toast.success('Order placed successfully!');
    onClearCart();
    onClose();
  };

  const handlePaymentCancel = (paymentId: string) => {
    toast.warning;
    console.log('Order payment cancelled by user:', paymentId);
  };

  const handlePaymentError = (error: Error) => {
    console.error('Order payment failed:', error);
    toast.error("An error occurred during payment. Please try again.");
  };

  const backdropVariants = {
    visible: { opacity: 1 },
    hidden: { opacity: 0 },
  };

  const panelVariants = {
    visible: { x: 0 },
    hidden: { x: '100%' },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={backdropVariants}
            transition={{ duration: 0.3 }}
            onClick={onClose}
          />

          {/* Cart Panel */}
          <motion.div
            className="absolute right-0 top-0 h-full w-full max-w-md bg-gray-900 shadow-2xl border-l border-gray-700"
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={panelVariants}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
                <h2 className="text-xl font-bold text-white">Your Cart</h2>
                <button
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:bg-gray-800 hover:text-white rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Cart Items */}
              <div className="flex-1 overflow-y-auto p-4">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
                    <ShoppingCart size={48} className="mb-4 text-gray-600" />
                    <h3 className="text-lg font-semibold text-white mb-1">Your cart is empty</h3>
                    <p>Add some delicious items to get started!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {items.map((item) => (
                      <div key={item.id} className="flex items-start gap-4 bg-gray-800 rounded-xl p-4">
                        {/* Dish Image */}
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-16 h-16 bg-gray-700 rounded-lg flex items-center justify-center text-gray-500 flex-shrink-0">🍽️</div>
                        )}
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h4 className="font-semibold text-white">{item.name}</h4>
                            {item.options && Object.keys(item.options).length > 0 && (
                              <div className="text-xs text-gray-400 mt-2 pl-2 border-l-2 border-gray-700 space-y-1">
                                {Object.entries(item.options)
                                  .filter(([_, value]) => (Array.isArray(value) ? value.length > 0 : !!value))
                                  .map(([key, value]) => (
                                    <div key={key}>
                                      <span className="font-semibold text-gray-300 capitalize">{key}:</span>
                                      <span className="text-purple-300 ml-1.5">
                                        {Array.isArray(value) ? value.join(', ') : value}
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            )}
                            <p className="text-sm text-gray-400 mt-1">{store?.name}</p>
                            <p className="text-sm font-semibold text-purple-400 mt-1">{formatPiPrice(item.price)}</p>
                          </div>
                          <button
                            onClick={() => onRemoveItem(item.id)}
                            className="text-gray-500 hover:text-red-500 p-1 transition-colors flex-shrink-0"
                          >
                            <Trash2 size={16} />
                          </button>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => onUpdateQuantity(item.id, Math.max(1, item.quantity - 1))}
                                className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center hover:bg-gray-600 transition-all active:scale-95 text-white font-bold"
                              >
                                -
                              </button>
                              <span className="w-8 text-center font-semibold text-white">{item.quantity}</span>
                              <button
                                onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                                className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center hover:bg-gray-600 transition-all active:scale-95 text-white font-bold"
                              >
                                +
                              </button>
                            </div>
                            <span className="font-semibold text-white">
                              {formatPiPrice(item.price * item.quantity)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Checkout */}
              {items.length > 0 && (
                <div className="border-t border-gray-700 p-4 bg-gray-900">
                  {/* Summary Header with Toggle */}
                  <div className="flex justify-between items-center mb-4 cursor-pointer" onClick={() => setShowSummaryDetails(!showSummaryDetails)}>
                    <h3 className="text-xl font-bold text-white">Order Summary</h3>
                    <button className="text-gray-400 hover:text-white">
                      {showSummaryDetails ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                  </div>

                  {/* Collapsible Summary Details */}
                  <AnimatePresence>
                    {showSummaryDetails && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-4 pt-4">
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm text-gray-300">
                              <span>Subtotal</span>
                              <span className="font-mono">{formatPiPrice(subtotal)}</span>
                            </div>
                            {appliedDiscount && (
                              <div className="flex justify-between items-center text-green-400 text-sm">
                                <div className="flex items-center gap-2">
                                  <span>Discount ({appliedDiscount.code})</span>
                                  <button onClick={handleRemoveDiscount} title="Remove discount">
                                    <XCircle className="h-4 w-4 text-red-500 hover:text-red-400" />
                                  </button>
                                </div>
                                <span className="font-mono">-{formatPiPrice(discountAmount)}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-sm text-gray-300">
                              <span>Delivery Fee {dynamicDeliveryFee !== undefined && dynamicDeliveryFee !== null && <span className="text-xs text-purple-400 ml-1">(Dynamic)</span>}</span>
                              {deliveryFee === null ? (
                                <span className="font-mono animate-pulse">...</span>
                              ) : (
                                <span className="font-mono">{formatPiPrice(deliveryFee)}</span>
                              )}
                            </div>
                            <div className="flex justify-between font-bold text-lg text-white border-t border-gray-700 pt-3 mt-2">
                              <span>Total</span>
                              <span className="font-mono">{formatPiPrice(total)}</span>
                            </div>
                          </div>

                          <DiscountCodeInput
                            onApply={handleApplyCode}
                            isLoading={isLoading}
                            disabled={!!appliedDiscount}
                          />

                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <label className="block text-sm font-medium text-gray-300">
                                Delivery Address
                              </label>
                            </div>
                            
                            {addressesData?.addresses && addressesData.addresses.length > 0 ? (
                                <div className="space-y-2">
                                    <Popover open={isAddressPopoverOpen} onOpenChange={setIsAddressPopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                        variant="outline"
                                        role="combobox"
                                        className="w-full justify-between bg-gray-800 border-gray-600 text-white hover:bg-gray-700 h-auto py-3"
                                        >
                                        {selectedAddress ? (
                                            <div className="flex flex-col items-start text-left">
                                                <span className="font-semibold">{selectedAddress.label}</span>
                                                <span className="text-xs text-gray-400">{selectedAddress.address}, {selectedAddress.city}</span>
                                            </div>
                                        ) : "Select an address"}
                                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] p-0 bg-gray-900 border-gray-700 text-white">
                                        <Command className="bg-gray-900 text-white rounded-lg">
                                            <CommandInput placeholder=" Search address..." className="h-9 border-gray-700 bg-gray-800 text-white focus:ring-purple-500" />
                                            <CommandEmpty>No address found.</CommandEmpty>
                                            <CommandGroup className="max-h-40 overflow-y-auto">
                                                {addressesData.addresses.map((addr) => (
                                                <CommandItem
                                                    key={addr._id}
                                                    value={addr._id}
                                                    onSelect={() => {
                                                        setSelectedAddressId(addr._id);
                                                        setDeliveryAddress(`${addr.address}, ${addr.city}, ${addr.country}`);
                                                        setIsAddressPopoverOpen(false);
                                                    }}
                                                    className="cursor-pointer hover:bg-purple-500/20"
                                                >
                                                    <div className="flex flex-col w-full">
                                                        <div className="flex justify-between items-center">
                                                            <span className="font-medium text-white">{addr.label}</span>
                                                            {selectedAddressId === addr._id && <Check className="h-4 w-4 text-purple-500" />}
                                                        </div>
                                                        <span className="text-xs text-gray-400">{addr.address}, {addr.city}</span>
                                                    </div>
                                                </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </Command>
                                    </PopoverContent>
                                    </Popover>
                                </div>
                            ) : (
                                <div className="text-center p-4 border border-dashed border-gray-700 rounded-xl bg-gray-800/30">
                                    <p className="text-sm text-gray-400 mb-2">No saved addresses found.</p>
                                    <p className="text-xs text-gray-500">Please go to your Account to add a delivery address.</p>
                                </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Inventory Issues Display */}
                  {inventoryIssues.length > 0 && (
                    <div className="mt-4 space-y-2 rounded-lg bg-yellow-500/10 p-3 border border-yellow-500/30">
                      {inventoryIssues.map(issue => (
                        <div key={issue.cartItemId} className="flex items-start gap-2 text-sm text-yellow-300">
                          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <span>
                            <strong>{issue.name}:</strong>
                            {issue.status === 'insufficient_stock' && ` Only ${issue.available} left in stock.`}
                            {issue.status === 'unavailable' && ` This item is no longer available.`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Delivery Validation Warning */}
                  {!deliveryValidation.allowed && (
                      <div className="mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                          <span>{deliveryValidation.reason}</span>
                      </div>
                  )}

                  <div className="mt-4">
                    
                    <PiPayment
                      amount={total}
                      memo={`OmniGo Order - ${items.length} items`}
                      metadata={{
                        storeId: storeId, // All items are from the same store
                        items: items.map(item => ({
                          id: item.productId,
                          name: item.name,
                          quantity: item.quantity,
                          price: item.price,
                          options: item.options,
                        })),
                        deliveryAddress,
                        deliveryCity: selectedAddress?.city,
                        deliveryCountry: selectedAddress?.country,
                        subtotal,
                        discount: appliedDiscount ? { code: appliedDiscount.code, amount: discountAmount } : undefined,
                        deliveryFee: deliveryFee ?? 0,
                        total,
                      } as any}
                      onPaymentSuccess={handlePaymentSuccess}
                      onPaymentCancel={handlePaymentCancel}
                      onPaymentError={handlePaymentError}
                      disabled={!deliveryAddress.trim() || subtotal === 0 || !storeId || inventoryIssues.length > 0 || isCheckingInventory || !deliveryValidation.allowed}
                    >
                      <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-200 font-semibold text-center shadow-lg hover:scale-105 active:scale-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100">
                        {subtotal > 0 ? `Pay ${formatPiPrice(total)} with Pi Wallet` : 'Add items to cart'}
                      </div>
                    </PiPayment>
                  </div>
                  
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
