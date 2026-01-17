import { useCart } from '../context/CartContext';
import { toast } from 'sonner';
import { Plus, Star, Package, Heart, Loader2 } from 'lucide-react';
import { formatPiPrice } from '../lib/utils';
import { Doc, Id } from '../../convex/_generated/dataModel';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../hooks/useAuth';
import { useState } from 'react';

type ProductWithUrl = Doc<"products"> & { imageUrls: (string | null)[] };
interface ProductItemsListProps {
  products: Record<string, ProductWithUrl[]>;
  store: any;
  onProductItemSelect: (item: ProductWithUrl) => void;
}

function FavoriteButton({ productId }: { productId: Id<"products"> }) {
  const { sessionToken } = useAuth();
  const [isToggling, setIsToggling] = useState(false);

  const isFavorited = useQuery(
    api.favorites.isProductFavorite,
    sessionToken ? { tokenIdentifier: sessionToken, productId } : "skip"
  );

  const toggleFavorite = useMutation(api.favorites.toggleFavorite);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent the modal from opening
    if (!sessionToken) {
      toast.error("Please sign in to like products.");
      return;
    }
    setIsToggling(true);
    try {
      await toggleFavorite({ tokenIdentifier: sessionToken, productId });
    } catch (error) {
      toast.error("Failed to update favorite status.");
      console.error(error);
    } finally {
      setIsToggling(false);
    }
  };

  // Don't render the button if the user isn't logged in or status is unknown
  if (sessionToken === null || isFavorited === undefined) {
    return null;
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isToggling}
      className="absolute top-2 left-2 z-10 p-2 rounded-full bg-black/30 backdrop-blur-sm text-white transition-colors duration-200 hover:bg-black/50"
      aria-label={isFavorited ? "Unlike product" : "Like product"}
    >
      {isToggling ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <Heart size={16} className={`transition-all ${isFavorited ? 'text-red-500 fill-red-500' : 'text-white/80'}`} />
      )}
    </button>
  );
}

export function ProductItemsList({ products, store, onProductItemSelect }: ProductItemsListProps) {
  const categories = Object.keys(products);

  if (categories.length === 0) {
    return (
      <div className="text-center py-16 bg-gray-900/50 border border-gray-700 rounded-2xl">
        <div className="text-6xl mb-4">📥</div>
        <h3 className="text-2xl font-bold text-white mb-2">Products are Coming Soon!</h3>
        <p className="text-gray-400 max-w-md mx-auto">This store is currently preparing its product list. Please check back later.</p>
      </div>
    );
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

  return (
    <div className="space-y-8">
      {categories.map((category) => (
        <div key={category}>
          <h3 id={`category-${category.replace(/\s+/g, '-')}`} className="text-2xl sm:text-3xl font-bold text-white mb-4 sm:mb-6 capitalize border-b-2 border-gray-700 pb-3 scroll-mt-24">
            {category}
          </h3>
          
          <div className="flex space-x-4 overflow-x-auto pb-4 -mb-4 scrollbar-hide">
            {products[category].map((item) => (
              <div
                key={item._id}
                onClick={() => item.isAvailable && onProductItemSelect(item)}
                className={`group bg-gray-800 border border-gray-700/50 rounded-2xl flex flex-col transition-all duration-300 overflow-hidden relative w-40 sm:w-44 flex-shrink-0 ${!item.isAvailable ? 'opacity-50' : 'hover:shadow-xl hover:border-purple-500 cursor-pointer hover:-translate-y-1'}`}
              >
                <FavoriteButton productId={item._id} />
                {item.isPopular && (
                  <span className="absolute top-2 right-2 z-10 bg-yellow-500/20 text-yellow-400 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 flex-shrink-0 backdrop-blur-sm border border-yellow-500/30">
                    <Star size={12} className="fill-yellow-400" />
                    Popular
                  </span>
                )}
                {/* Low Stock Indicator */}
                {/* {item.quantity !== undefined && item.quantity > 0 && item.quantity <= 10 && (
                  <div className="absolute top-2 left-2 z-10 bg-orange-500/20 text-orange-400 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 backdrop-blur-sm border border-orange-500/30">
                    <Package size={12} />
                    <span>{item.quantity} left</span>
                  </div>
                )} */}
                <div className="aspect-square w-full overflow-hidden">
                  {item.imageUrls && item.imageUrls.length > 0 ? (
                    <img
                      src={item.imageUrls[0]!}
                      alt={item.name}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-700 flex items-center justify-center text-gray-500 text-5xl">
                      🍽️
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-3 text-left">
                  <h4 className="text-md font-semibold text-white truncate">
                    {item.name}
                    <span className="ml-1">{getSpiceLevelEmoji(item.spiceLevel)}</span>
                  </h4>
                  <div className="text-sm font-bold text-purple-400 mt-1">
                    {formatPiPrice(item.price)}
                  </div>
                </div>
                
                {!item.isAvailable && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                      Unavailable
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
                      
