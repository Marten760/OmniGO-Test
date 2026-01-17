import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Heart, Clock, Star, Truck, StarHalf, Soup, ShoppingCart, Pill, Store as StoreIcon, Tag, Loader2 } from "lucide-react";
import { useState, useMemo } from "react";
import { Doc, Id } from "../../convex/_generated/dataModel";

type StoreWithUrl = Doc<"stores"> & { imageUrl: string | null };

interface StoreCardProps {
  store: StoreWithUrl;
  onSelect: (id: Id<"stores">) => void;
}

export function StoreCard({ store, onSelect }: StoreCardProps) {
  // This query is no longer needed in this component
  /* const user = useQuery(
    api.auth.getUserFromToken,
    sessionToken ? { tokenIdentifier: sessionToken } : "skip"
  ); */

  // Helper to get today's opening hours status
  const getStoreStatus = () => {
    // Case 1: Manually closed by the owner.
    if (!store.isOpen) {
      return { text: "Temporarily Closed", color: "text-red-400" };
    }

    const now = new Date();
    const todayStr = now.toLocaleDateString('en-US', { weekday: 'long' });
    const todaysHours = store.openingHours.find(h => h.day === todayStr);

    // Case 2: Not scheduled to be open today.
    if (!todaysHours || !todaysHours.isOpen) {
      return { text: "Closed Today", color: "text-red-400" };
    }

    // Case 3: Scheduled to be open, check current time.
    const [openHour, openMinute] = todaysHours.open.split(':').map(Number);
    const [closeHour, closeMinute] = todaysHours.close.split(':').map(Number);

    const openTime = new Date();
    openTime.setHours(openHour, openMinute, 0, 0);

    const closeTime = new Date();
    closeTime.setHours(closeHour, closeMinute, 0, 0);

    // Handle overnight hours
    if (closeTime < openTime && now < openTime) {
      openTime.setDate(openTime.getDate() - 1);
    } else if (closeTime < openTime) {
      closeTime.setDate(closeTime.getDate() + 1);
    }

    if (now >= openTime && now <= closeTime) {
      return { text: `Open until ${todaysHours.close}`, color: "text-green-400" };
    } else if (now < openTime) {
      return { text: `Opens at ${todaysHours.open}`, color: "text-yellow-400" };
    } else {
      return { text: "Closed", color: "text-red-400" };
    }
  };

  const storeStatus = getStoreStatus();


  const getStoreIcon = (type: string) => {
    switch (type) {
      case 'restaurant': return <Soup className="w-10 h-10 text-white/80" />;
      case 'grocery': return <ShoppingCart className="w-10 h-10 text-white/80" />;
      case 'pharmacy': return <Pill className="w-10 h-10 text-white/80" />;
      default: return <StoreIcon className="w-10 h-10 text-white/80" />;
    }
  };

  
  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating - fullStars >= 0.5;

    // Full stars
    for (let i = 0; i < fullStars; i++) {
      stars.push(<Star key={`full-${i}`} size={12} className="text-yellow-400 fill-yellow-400" />);
    }

    // Half star
    if (hasHalfStar) {
      stars.push(<StarHalf key="half" size={12} className="text-yellow-400 fill-yellow-400" />);
    }

    // Empty stars
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(<Star key={`empty-${i}`} size={12} className="text-gray-400" />);
    }

    return stars;
  };

  const formatPrice = (price: number) => {
    return `π${price.toFixed(2)}`;
  };

  const isNew = Date.now() - store._creationTime < 7 * 24 * 60 * 60 * 1000;

  return (
    <div 
      className="bg-gray-800 rounded-2xl shadow-lg cursor-pointer transition-all duration-300 hover:bg-gray-700/50 hover:shadow-purple-500/10 group flex space-x-3 sm:space-x-4 p-2 sm:p-3"
      onClick={() => onSelect(store._id)}
    >
      {/* Image Section */}
      <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0">
        {store.imageUrl ? (
          <img 
            src={store.imageUrl} 
            alt={store.name} 
            loading="lazy"
            className="w-full h-full object-cover rounded-xl" 
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center rounded-xl">
            {getStoreIcon(store.storeType)}
          </div>
        )}
      </div>
      
      {/* Details Section */}
      <div className="flex-1 flex flex-col justify-between min-w-0">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-white font-semibold text-sm sm:text-base line-clamp-1 flex-shrink">{store.name}</h3>
            {isNew && (
              <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0">NEW</span>
            )}
          </div>
          <div className="flex items-center space-x-1 mt-1">
            {renderStars(store.rating)}
            <span className="text-gray-400 text-xs">({store.totalReviews})</span>
          </div>
          <p className="text-gray-400 text-sm mt-1 truncate">{store.categories.join(', ')} • {Array.isArray(store.priceRange) ? store.priceRange.join(' • ') : store.priceRange}</p>
        </div>

        <div className="flex items-center justify-between text-sm mt-2">
          <span className={storeStatus.color}>{storeStatus.text}</span>
          {store.hasDelivery && (
            <div className="flex items-center space-x-1 text-gray-400">
              <Truck size={14} />
              <span>Delivery</span>
            </div>
          )}
        </div>

        {store.hasOffer && store.offerText && (
          <div className="mt-2 flex items-center gap-1.5 bg-red-500/10 text-red-400 text-xs font-medium px-2 py-1 rounded-md border border-red-500/20 w-fit">
            <Tag size={12} />
            <span className="line-clamp-1">{store.offerText}</span>
          </div>
        )}
      </div>
    </div>
  );
}
