import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Flame, Plus } from "lucide-react";

interface PopularItemsProps {
  storeId: Id<"stores">;
}

export function PopularItems({ storeId }: PopularItemsProps) {
  const popularItems = useQuery(api.products.getPopularProducts, {
    storeId,
    limit: 7,
  });

  if (!popularItems || popularItems.length === 0) {
    return null;
  }

  const formatPrice = (price: number) => {
    return `π${price.toFixed(2)}`;
  };

  return (
    <div className="mb-8">
      <div className="flex items-center space-x-2 mb-4">
        <Flame className="text-orange-400" size={22} />
        <h2 className="text-xl font-bold text-white">Most Popular</h2>
      </div>
      <div className="flex space-x-4 overflow-x-auto pb-4 -mb-4 scrollbar-hide">
        {popularItems.map((item) => (
          <div key={item._id} className="flex-shrink-0 w-40 cursor-pointer group">
            <div className="relative">
              {item.imageUrl ? (
                <img src={item.imageUrl} alt={item.name} className="w-full h-28 object-cover rounded-xl transition-transform duration-300 group-hover:scale-105" />
              ) : (
                <div className="w-full h-28 bg-gray-700 rounded-xl flex items-center justify-center"><span className="text-3xl">🍕</span></div>
              )}
              <div className="absolute inset-0 bg-black/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <button className="absolute top-2 right-2 bg-white/20 backdrop-blur-sm p-1.5 rounded-full text-white hover:bg-purple-600 transition-colors opacity-0 group-hover:opacity-100 transition-all duration-200 scale-90 group-hover:scale-100">
                <Plus size={16} />
              </button>
            </div>
            <div className="mt-2">
              <p className="text-white font-medium text-sm truncate">{item.name}</p>
              <p className="text-gray-400 text-xs">{formatPrice(item.price)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}