import { useState, useMemo, useEffect, useRef } from 'react';
import { X, Plus, Minus, ShoppingCart, Package, AlertTriangle } from 'lucide-react';
import { useCart } from '../context/CartContext'; // Assuming this is correct path
import { Id } from '../../convex/_generated/dataModel';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';import { toast } from 'sonner';
import { formatPiPrice } from '../lib/utils';

import { useAuth } from '../hooks/useAuth';

interface ProductItemOptionChoice {
  name: string;
  price_increment: number;
  quantity?: number;
}

interface ProductItemOption {
  title: string;
  type: 'single' | 'multiple';
  choices: ProductItemOptionChoice[];
}

interface ProductItem {
  _id: string;
  name: string;
  price: number;
  description: string;
  spiceLevel?: string;
  quantity?: number;
  imageUrls: (string | null)[];
  options?: ProductItemOption[];
  storeName: string;
  storeId: Id<"stores">;
}

interface ProductItemDetailModalProps {
  item: ProductItem;
  isOpen: boolean;
  onClose: () => void;
  onStoreSelect: (storeId: Id<"stores">) => void; // New prop for navigating to store
}

const getSpiceLevelEmoji = (level?: string) => {
  switch (level) {
    case "mild": return "🌶️";
    case "medium": return "🌶️🌶️";
    case "hot": return "🌶️🌶️🌶️";
    case "very hot": return "🌶️🌶️🌶️🌶️";
    default: return "";
  }
};

export function ProductItemDetailModal({ item, isOpen, onClose, onStoreSelect }: ProductItemDetailModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string | string[]>>({});
  const { addItem } = useCart();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const store = useQuery(api.stores.getStoreById, { storeId: item.storeId });
  const { sessionToken } = useAuth();
  const user = useQuery(api.auth.getUserFromToken, sessionToken ? { tokenIdentifier: sessionToken } : "skip");

  // Reset state every time the modal is opened with a new item.
  useEffect(() => {
    if (isOpen) {
      setQuantity(1);
      setSelectedOptions({});
      setCurrentImageIndex(0);
    }
  }, [isOpen, item._id]);

  const handleOptionChange = (optionTitle: string, choiceName: string, type: 'single' | 'multiple') => {
    setSelectedOptions(prev => {
      const newOptions = { ...prev };
      if (type === 'single') {
        newOptions[optionTitle] = choiceName;
      } else {
        const currentChoices = (newOptions[optionTitle] as string[] | undefined) || [];
        if (currentChoices.includes(choiceName)) {
          newOptions[optionTitle] = currentChoices.filter((c: string) => c !== choiceName);
        } else {
          newOptions[optionTitle] = [...currentChoices, choiceName];
        }
      }
      return newOptions;
    });
  };

  const totalPrice = useMemo(() => {
    let basePrice = item.price;
    let optionsPrice = 0;
    if (item.options) {
      for (const option of item.options) {
        const selected = selectedOptions[option.title];
        if (selected) {
          if (option.type === 'single') {
            const choice = option.choices.find(c => c.name === selected);
            if (choice) optionsPrice += choice.price_increment;
          } else {
            for (const choiceName of selected as string[]) {
              const choice = option.choices.find(c => c.name === choiceName);
              if (choice) optionsPrice += choice.price_increment;
            }
          }
        }
      }
    }
    return (basePrice + optionsPrice) * quantity;
  }, [item, selectedOptions, quantity]);

  const pricePerItem = useMemo(() => totalPrice / quantity, [totalPrice, quantity]);

  const availableStock = useMemo(() => {
    // If the store is a restaurant, stock is effectively infinite.
    if (item.storeName.toLowerCase().includes('pizza') || item.storeName.toLowerCase().includes('restaurant')) {
      return Infinity;
    }

    // If no options are selected for a product that has options, use the product's total quantity.
    if (item.options && item.options.length > 0 && Object.keys(selectedOptions).length === 0) {
      return item.quantity ?? Infinity;
    }

    // If options are selected, find the minimum stock of the selected options.
    if (item.options && item.options.length > 0) {
      const selectedChoices = Object.entries(selectedOptions).flatMap(([optionTitle, choiceNames]) => {
        const option = item.options?.find(o => o.title === optionTitle);
        if (!option) return [];
        const names = Array.isArray(choiceNames) ? choiceNames : [choiceNames];
        return names.map(name => option.choices.find(c => c.name === name)).filter(Boolean);
      });

      return Math.min(...selectedChoices.map(c => c?.quantity ?? Infinity));
    }

    // If no options, use the product's top-level quantity.
    return item.quantity ?? Infinity;
  }, [item, selectedOptions]);

  const { isStoreOpen, storeStatusMessage } = useMemo(() => {
    if (!store) return { isStoreOpen: false, storeStatusMessage: "Loading store info..." };

    if (!store.isOpen) {
      return { isStoreOpen: false, storeStatusMessage: "Store is currently closed" };
    }

    const now = new Date();
    const today = now.toLocaleDateString('en-US', { weekday: 'long' });
    const todaysHours = store.openingHours.find(h => h.day === today);

    if (!todaysHours || !todaysHours.isOpen) {
      return { isStoreOpen: false, storeStatusMessage: "Closed today" };
    }

    const [openHour, openMinute] = todaysHours.open.split(':').map(Number);
    const [closeHour, closeMinute] = todaysHours.close.split(':').map(Number);

    const openTime = new Date();
    openTime.setHours(openHour, openMinute, 0, 0);

    const closeTime = new Date();
    closeTime.setHours(closeHour, closeMinute, 0, 0);

    // Handle overnight hours (e.g., closes at 02:00)
    if (closeTime < openTime && now < openTime) {
      openTime.setDate(openTime.getDate() - 1);
    } else if (closeTime < openTime) {
      closeTime.setDate(closeTime.getDate() + 1);
    }

    if (now >= openTime && now <= closeTime) {
      return { isStoreOpen: true, storeStatusMessage: "" };
    } else {
      return { isStoreOpen: false, storeStatusMessage: `Opens at ${todaysHours.open}` };
    }
  }, [store]);

  const deliveryValidation = useMemo(() => {
    if (!sessionToken) return { allowed: true }; // Allow guests to add to cart (validation happens at checkout)
    if (!user?.profile) return { allowed: true }; // Optimistic

    if (!user.profile.country || !user.profile.city) {
        return { allowed: false, reason: "Please update your profile with your Country and City to order." };
    }

    if (!store) return { allowed: false, reason: "Loading store info..." };

    if (store.hasDelivery) {
        if (store.country !== user.profile.country) {
             return { allowed: false, reason: `This store only delivers within ${store.country}.` };
        }
        if (store.deliveryRegions && store.deliveryRegions.length > 0) {
             const isAllowList = store.isDeliveryRegionsAllowList ?? true;
             const inList = store.deliveryRegions.includes(user.profile.city);
             const allowed = isAllowList ? inList : !inList;
             if (!allowed) return { allowed: false, reason: `This store does not deliver to ${user.profile.city}.` };
        }
    }
    return { allowed: true };
  }, [user, store, sessionToken]);

  // Effect to adjust quantity if it exceeds available stock (e.g., when options change)
  useEffect(() => {
    if (quantity > availableStock) {
      setQuantity(availableStock > 0 ? availableStock : 1);
      
    }
  }, [availableStock, quantity]);

  const handleAddToCart = () => {
    // Create a unique ID for the cart item based on the food item and its selected options
    addItem({
      id: item._id, // The backend will generate a unique ID for the cart item
      productId: item._id as Id<"products">, // Pass the product ID explicitly
      name: item.name,
      price: pricePerItem,
      quantity: quantity,
      storeId: item.storeId,
      imageUrl: item.imageUrls?.[0] ?? null,
      options: selectedOptions,
    }).then(() => {
      toast.success(`${quantity} x ${item.name} added!`);
      onClose();
    }).catch((error) => {
      // The context already shows a toast for clearing the cart or other errors.
      // We only need to handle the cancellation case if we want specific logic for it.
      console.log("Add to cart cancelled or failed:", error.message);
    });
  };

  const isOutOfStock = availableStock <= 0;
  const hasMultipleImages = item.imageUrls && item.imageUrls.length > 1;

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, clientWidth } = scrollContainerRef.current;
      const newIndex = Math.round(scrollLeft / clientWidth);
      setCurrentImageIndex(newIndex);
    }
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end animate-fade-in" onClick={onClose}>
      <div className="bg-gray-900 w-full max-h-[90vh] rounded-t-3xl overflow-y-auto animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-gray-900/80 backdrop-blur-md p-4 flex items-center justify-end z-10">
          <button onClick={onClose} className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-800 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-2 sm:p-6 pt-0">
          {item.imageUrls && item.imageUrls.length > 0 ? (
            <div className="relative mb-4 sm:mb-6">
              <div 
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex overflow-x-auto snap-x snap-mandatory snap-stop-always scrollbar-hide rounded-2xl bg-gray-800 items-center"
              >
                {item.imageUrls.map((url, index) => (
                  url && <img key={index} src={url} alt={`${item.name} ${index + 1}`} className="w-full aspect-square object-contain rounded-2xl snap-center flex-shrink-0" />
                ))}
              </div>
              {hasMultipleImages && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                  {item.imageUrls.map((_, index) => (
                    <div
                      key={index}
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${index === currentImageIndex ? 'bg-white scale-125' : 'bg-white/50'}`}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-48 sm:h-64 bg-gray-800 border border-dashed border-gray-700 flex items-center justify-center text-gray-500 text-6xl rounded-2xl mb-4 sm:mb-6">🍽️</div>
          )}

          <div className="flex items-start justify-between gap-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
              {item.name}
              <span className="ml-2 text-2xl">{getSpiceLevelEmoji(item.spiceLevel)}</span>
            </h2>
            {item.quantity !== undefined && (
              <div className={`flex-shrink-0 text-sm font-bold px-3 py-1.5 rounded-full flex items-center gap-2 border ${
                item.quantity <= 5 ? 'bg-red-500/20 text-red-400 border-red-500/30' : 
                item.quantity <= 10 ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                'bg-green-500/20 text-green-400 border-green-500/30'
              }`}>
                <Package size={16} />
                <span>{item.quantity} in stock</span>
              </div>
            )}
          </div>
          <p className="text-gray-400 mb-6">{item.description}</p>

          

          {item.options?.map(option => (
            <div key={option.title} className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-3">{option.title}</h3>
              <div className="space-y-3">
                {option.choices.map(choice => {
                  const isChoiceOutOfStock = choice.quantity !== undefined && choice.quantity <= 0;
                  return (
                  <label key={choice.name} className={`flex items-center justify-between bg-gray-800 p-4 rounded-xl border-2 transition-all ${isChoiceOutOfStock ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer border-transparent has-[:checked]:border-purple-500 has-[:checked]:bg-purple-600/20'}`}>
                    <div className="flex flex-col">
                      <span className={`font-medium ${isChoiceOutOfStock ? 'text-gray-500' : 'text-white'}`}>{choice.name}</span>
                      <div className="flex items-center gap-2">
                        {choice.price_increment > 0 && <span className="text-sm text-gray-400">(+{formatPiPrice(choice.price_increment)})</span>}
                        {choice.quantity !== undefined && (
                           <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                            choice.quantity <= 0 ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                            choice.quantity <= 5 ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                            choice.quantity <= 10 ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                            'bg-green-500/20 text-green-400 border-green-500/30'
                          }`}>{choice.quantity} in stock</span>
                        )}
                      </div>
                    </div>
                    
                    <input
                      type={option.type === 'single' ? 'radio' : 'checkbox'}
                      name={option.title}
                      checked={option.type === 'single' ? selectedOptions[option.title] === choice.name : selectedOptions[option.title]?.includes(choice.name)}
                      onChange={() => handleOptionChange(option.title, choice.name, option.type)}
                      disabled={isChoiceOutOfStock}
                      className="form-radio h-5 w-5 text-purple-600 bg-gray-700 border-gray-600 focus:ring-purple-500"
                    />
                  </label>);
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-900/80 backdrop-blur-md p-4 border-t border-gray-700 flex flex-col gap-3">
          {!deliveryValidation.allowed && (
            <div className="w-full p-2 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-xs flex items-center justify-center gap-2">
                <AlertTriangle className="h-3 w-3" />
                <span>{deliveryValidation.reason}</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-4 w-full">
          {!isOutOfStock && (
            <div className="flex items-center space-x-2 sm:space-x-3 bg-gray-800 rounded-xl p-1">
              <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gray-700 flex items-center justify-center hover:bg-gray-600 transition-all active:scale-95 text-white font-bold">-</button>
              <span className="w-10 text-center font-bold text-white text-lg">{quantity}</span>
              <button onClick={() => setQuantity(q => Math.min(availableStock, q + 1))} disabled={quantity >= availableStock} className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gray-700 flex items-center justify-center hover:bg-gray-600 transition-all active:scale-95 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed">+</button>
            </div>
          )}
          {(() => {
            if (!isStoreOpen) {
              return <div className="flex-1 bg-gray-700 text-gray-400 px-6 py-3 rounded-xl font-semibold text-center">{storeStatusMessage}</div>;
            }
            if (!store?.hasDelivery) {
              return <div className="flex-1 bg-gray-700 text-gray-400 px-6 py-3 rounded-xl font-semibold text-center">This store does not offer delivery</div>;
            }
            return (
              <button
                onClick={handleAddToCart}
                disabled={isOutOfStock || !deliveryValidation.allowed}
                className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all duration-200 font-semibold shadow-lg hover:scale-105 flex items-center justify-center gap-2 disabled:bg-gray-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:opacity-50"
              >
                {isOutOfStock ? (
                  <span>Out of Stock</span>
                ) : (
                  <>
                    <ShoppingCart size={20} />
                    <span>Add to Cart ({formatPiPrice(totalPrice)})</span>
                  </>
                )}
              </button>
            );
          })()}
          </div>
        </div>
      </div>
    </div>
  );
}