import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { ArrowRight, Loader2 } from "lucide-react";

interface PromotionsCarouselProps {
  onStoreSelect: (id: Id<"stores">) => void;
  filters: any;
  country: string;
  region: string;
}

export function PromotionsCarousel({ onStoreSelect, filters, country, region }: PromotionsCarouselProps) {
  const promotions = useQuery(api.promotions.getActivePromotions, {
    storeType: filters.storeType,
    categories: filters.cuisine,
    country: country,
    region: region,
  });

  if (promotions === undefined) {
    return (
      <div className="h-48 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  if (promotions.length === 0) {
    return null; // Don't show the section if there are no active promotions
  }

  return (
    <div className="mb-8">
      <div className="flex items-center space-x-2 mb-4">
        <h2 className="text-2xl font-bold text-white">Special Offers</h2>
      </div>
      <div className="flex space-x-4 overflow-x-auto pb-4 -mb-4 scrollbar-hide">
        {promotions.map((promo) => (
          <div
            key={promo._id}
            onClick={() => onStoreSelect(promo.targetStoreId)}
            className="w-80 sm:w-96 flex-shrink-0 bg-gray-800 rounded-2xl overflow-hidden cursor-pointer group transition-all duration-300 hover:shadow-xl hover:shadow-purple-900/20 hover:scale-[1.02]"
          >
            <div className="relative">
              <img src={promo.imageUrl!} alt={promo.title} className="w-full h-48 sm:h-56 object-cover transition-transform duration-300 group-hover:scale-105" />
              {promo.badgeText && (
                <div className="absolute top-3 right-3 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                  {promo.badgeText}
                </div>
              )}
            </div>
            <div className="p-4">
              <h3 className="font-bold text-lg text-white truncate">{promo.title}</h3>
              {promo.description && <p className="text-sm text-gray-400 mt-1 truncate">{promo.description}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
