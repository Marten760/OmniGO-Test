import React from 'react';
import { useCart } from '../context/CartContext';
import { Button } from './ui/button';
import { Trash2, Plus, Minus, Loader2 } from 'lucide-react';
import { CheckoutSummary } from './CheckoutSummary';
import { Id } from '../../convex/_generated/dataModel';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

export const CartView = () => {
  const { items, updateQuantity, removeItem, clearCart } = useCart();

  if (items.length === 0) {
    return (
      <div className="text-center p-8 text-gray-400">
        <h2 className="text-3xl font-bold text-white mb-4">سلة المشتريات</h2>
        <p>سلة مشترياتك فارغة.</p>
      </div>
    );
  }

  // Assuming all items in the cart are from the same store
  // Safely extract storeId, assuming all items are from the same store.
  // If the cart can contain items from multiple stores, this logic needs to be re-evaluated.
  const storeId = items.length > 0 && items[0].storeId ? (items[0].storeId as Id<'stores'>) : undefined;

  const store = useQuery(
    api.stores.getStoreById,
    storeId ? { storeId } : 'skip'
  );

  // This should probably come from the restaurant data, but we'll use a fixed value for now.
  const deliveryFee = 2.5; 

  if (store === undefined) {
    return <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!storeId) {
    return <div className="text-center p-8 text-gray-400">خطأ: لا يمكن تحديد المتجر لسلة المشتريات.</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h2 className="text-3xl font-bold text-white mb-6">سلة المشتريات من {store?.name ?? 'المتجر'}</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cart Items List */}
        <div className="lg:col-span-2 bg-gray-800/50 border border-gray-700 rounded-2xl p-6 space-y-4">
          {items.map(item => (
            <div key={item.id} className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
              <div className="flex-1">
                <p className="font-semibold text-white">{item.name}</p>
                <p className="text-sm text-gray-400">{item.price.toFixed(2)}π</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center border border-gray-600 rounded-md bg-gray-700">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-gray-600" onClick={() => updateQuantity(item.id, item.quantity - 1)} aria-label={`Decrease quantity of ${item.name}`}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="px-3 text-white font-mono">{item.quantity}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-gray-600" onClick={() => updateQuantity(item.id, item.quantity + 1)} aria-label={`Increase quantity of ${item.name}`}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <p className="w-20 text-right font-semibold text-white font-mono">
                  {(item.price * item.quantity).toFixed(2)}π
                </p>
                <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-500/10 hover:text-red-400" onClick={() => removeItem(item.id)} aria-label={`Remove ${item.name} from cart`}>
                  <Trash2 className="h-5 w-5" />
                </Button>
              </div>
            </div>
          ))}
           <div className="pt-4">
             <Button variant="outline" onClick={clearCart} className="border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300">
                إفراغ السلة
             </Button>
           </div>
        </div>

        {/* Checkout Summary */}
        <div className="lg:col-span-1">
          <CheckoutSummary 
            storeId={storeId} 
            deliveryFee={deliveryFee} 
          />
        </div>
      </div>
    </div>
  );
};
