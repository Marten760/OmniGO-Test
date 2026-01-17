import { Id } from "../../convex/_generated/dataModel";
import { Star, StarHalf } from "lucide-react";
import { Doc } from "../../convex/_generated/dataModel";
import { formatPiPrice } from "../lib/utils";

interface ProductCarouselCardProps {
  product: Doc<"products"> & {
    imageUrls: (string | null)[]; // Corrected to array of strings
    storeId: Id<"stores">;
    storeName: string;
    storeImageUrl: string | null;
    storeRating: number;
    totalReviews: number;
  };
  onProductSelect: (product: Doc<"products"> & { storeName: string; storeId: Id<"stores">; imageUrls: (string | null)[]; }) => void;
  onStoreSelect: (storeId: Id<"stores">) => void;
}

const renderStars = (rating: number) => {
  const stars = [];
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating - fullStars >= 0.5;

  for (let i = 0; i < fullStars; i++) {
    stars.push(<Star key={`full-${i}`} size={12} className="text-yellow-400 fill-yellow-400" />);
  }
  if (hasHalfStar) {
    stars.push(<StarHalf key="half" size={12} className="text-yellow-400 fill-yellow-400" />);
  }
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
  for (let i = 0; i < emptyStars; i++) {
    stars.push(<Star key={`empty-${i}`} size={12} className="text-gray-400" />);
  }
  return stars;
};

export function ProductCarouselCard({ product, onProductSelect, onStoreSelect }: ProductCarouselCardProps) {
  return (
    <div
      className="relative w-36 sm:w-44 flex-shrink-0 rounded-2xl overflow-hidden shadow-lg bg-gray-800 border border-gray-700 cursor-pointer group transition-all duration-300 hover:scale-105 hover:shadow-xl"
      onClick={() => onStoreSelect(product.storeId)}
    >
      {/* Product Image */}
      <div className="w-full h-28 sm:h-32 overflow-hidden rounded-t-2xl">
        {product.imageUrls && product.imageUrls.length > 0 ? (
          <img
            src={product.imageUrls[0]!} // Display the first image
            alt={product.name}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full bg-gray-700 flex items-center justify-center text-gray-500 text-5xl">
            🍽️
          </div>
        )}
      </div>

      {/* Store Logo */}
      <div
        className="absolute top-2 left-2 w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden shadow-md border-2 border-gray-800"
        onClick={(e) => { e.stopPropagation(); onStoreSelect(product.storeId); }}
        title={`View ${product.storeName}`}
      >
        {product.storeImageUrl ? (
          <img src={product.storeImageUrl} alt={`${product.storeName} logo`} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <span className="text-xl">🏪</span>
        )}
      </div>

      {/* Product Details */}
      <div className="p-3 text-center">
        <h4 className="font-bold text-white text-sm sm:text-base line-clamp-2 mb-1">
          {product.name}
        </h4>
        <p className="text-gray-400 text-sm line-clamp-1 mb-1">
          {product.storeName}
        </p>
        <div className="flex items-center justify-center space-x-1 mb-1">
          {renderStars(product.storeRating)}
          <span className="text-gray-400 text-xs">({product.totalReviews})</span>
        </div>
        <p className="font-semibold text-purple-400 text-base sm:text-lg">
          {formatPiPrice(product.price)}
        </p>
      </div>
    </div>
  );
}