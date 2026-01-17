import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { Id } from '../../convex/_generated/dataModel';
import { toast } from 'sonner';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../hooks/useAuth';

export interface CartItem {
  id: string; // Unique ID for the cart item, e.g., `${productId}-${JSON.stringify(options)}`
  productId: Id<'products'>; // The actual ID of the product
  name: string;
  price: number;
  quantity: number;
  storeId: Id<'stores'>;
  imageUrl?: string | null;
  options?: Record<string, any>;
  specialInstructions?: string;
}

interface CartContextType {
  items: CartItem[];
  pendingItem: CartItem | null;
  addItem: (item: CartItem, silent?: boolean) => Promise<any>;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  proceedWithNewItem: () => Promise<any>;
  cancelAddItem: () => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'OmniGo Cart';

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export const CartProvider = ({ children }: { children: ReactNode }) => {  const [items, setItems] = useState<CartItem[]>([]);
  const [pendingItem, setPendingItem] = useState<CartItem | null>(null);
  const { sessionToken } = useAuth();

  // Fetch cart items from the database
  const dbCartItems = useQuery(api.cart.getCartItems, sessionToken ? { tokenIdentifier: sessionToken } : "skip");

  // Mutations for cart operations
  const addItemMutation = useMutation(api.cart.addItemToCart);
  const updateQuantityMutation = useMutation(api.cart.updateCartItemQuantity);
  const removeItemMutation = useMutation(api.cart.removeCartItem);
  const clearCartMutation = useMutation(api.cart.clearCart);

  useEffect(() => {
    // When dbCartItems are fetched, update the local state
    if (dbCartItems) {
      const mappedItems = dbCartItems.map(item => ({
        id: item._id, // Use the database ID as the unique cart item ID
        productId: item.productId, // Pass the product ID
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        storeId: item.storeId,
        imageUrl: (item as any).imageUrls ?? undefined, // Fix: Use 'imageUrls' from backend and cast to any to avoid TS error
        options: item.options,
        specialInstructions: item.specialInstructions,
      }));
      setItems(mappedItems);
    }
  }, [dbCartItems]);

  const addItem = async (item: CartItem, silent = false) => {
    if (!sessionToken) {
      toast.error("Please sign in to add items to your cart.");
      return Promise.reject(new Error("User not signed in."));
    }

    // Check if cart has items from a different store
    if (items.length > 0 && items[0].storeId !== item.storeId) {
      setPendingItem(item);
      return Promise.reject(new Error("Confirmation required to clear cart."));
    }

    return addItemMutation({ tokenIdentifier: sessionToken, productId: item.productId, storeId: item.storeId, quantity: item.quantity, options: item.options });
  };

  const proceedWithNewItem = async () => {
    if (!sessionToken || !pendingItem) {
      return Promise.reject(new Error("No pending item or session token."));
    }
    await clearCartMutation({ tokenIdentifier: sessionToken });
    const result = await addItemMutation({
      tokenIdentifier: sessionToken,
      productId: pendingItem.productId,
      storeId: pendingItem.storeId,
      quantity: pendingItem.quantity,
      options: pendingItem.options,
    });
    setPendingItem(null);
    return result;
  };

  const cancelAddItem = () => {
    setPendingItem(null);
  };

  const removeItem = (id: string) => {
    if (!sessionToken) return;
    const promise = removeItemMutation({ tokenIdentifier: sessionToken, cartItemId: id as Id<"cartItems"> });
    toast.promise(promise, {
      loading: 'Removing item...',
      success: 'Item removed from cart.',
      error: (err) => `Failed to remove item: ${err.message}`,
    });
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (!sessionToken) return;
    // No need for a toast here as it's a frequent action and UI updates immediately.
    // The optimistic update from Convex handles the visual change.
    // We still call the mutation.
    updateQuantityMutation({ tokenIdentifier: sessionToken, cartItemId: id as Id<"cartItems">, quantity }).catch(err => {
      // If it fails, show an error and the UI will revert.
      toast.error(`Failed to update quantity: ${err.message}`);
    });
  };

  const clearCart = () => {
    if (!sessionToken) return;
    const promise = clearCartMutation({ tokenIdentifier: sessionToken });
    toast.promise(promise, {
      loading: 'Clearing cart...',
      success: 'Cart cleared.',
      error: (err) => `Failed to clear cart: ${err.message}`,
    });
  };

  const getTotalItems = () => items.reduce((sum, item) => sum + item.quantity, 0);
  const getTotalPrice = () => items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const value = { items, pendingItem, addItem, removeItem, updateQuantity, clearCart, proceedWithNewItem, cancelAddItem, getTotalItems, getTotalPrice };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};