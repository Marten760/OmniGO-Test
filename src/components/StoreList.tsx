import { useQuery, usePaginatedQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { StoreCard } from "./StoreCard";
import { PromotionsCarousel } from "./PromotionsCarousel";
import { ProductCarouselCard } from "./ProductCarouselCard"; // New import
import { TrendingUp, Award, MapPin, Loader2 } from "lucide-react";
import { Id, Doc } from "../../convex/_generated/dataModel";
import { useEffect, useState, useRef } from "react";

interface StoreListProps {
  country: string;
  region: string;
  searchTerm: string;
  filters: any;
  onStoreSelect: (id: Id<"stores">) => void;
  onProductSelect: (product: Doc<"products"> & { storeName: string; storeId: Id<"stores">; imageUrls: (string | null)[]; }) => void;
}

function StoreCardSkeleton() {
  return (
    <div className="bg-gray-800 rounded-2xl shadow-lg flex space-x-4 p-3">
      <div className="relative w-24 h-24 flex-shrink-0">
        <div className="w-full h-full bg-gray-700 rounded-xl skeleton-shimmer"></div>
      </div>
      <div className="flex-1 flex flex-col justify-between min-w-0 py-1">
        <div className="space-y-2">
          <div className="h-5 bg-gray-700 rounded w-3/4 skeleton-shimmer"></div>
          <div className="h-4 bg-gray-700 rounded w-1/2 skeleton-shimmer"></div>
          <div className="h-4 bg-gray-700 rounded w-5/6 skeleton-shimmer"></div>
        </div>
        <div className="flex items-center justify-between text-sm mt-2">
          <div className="h-4 bg-gray-700 rounded w-1/4 skeleton-shimmer"></div>
          <div className="h-4 bg-gray-700 rounded w-1/4 skeleton-shimmer"></div>
        </div>
      </div>
    </div>
  );
}

export function StoreList({
  country,
  region,
  searchTerm,
  filters,
  onStoreSelect,
  onProductSelect, // Destructure new prop
}: StoreListProps) {
  const [productLimit, setProductLimit] = useState(5);
  // New query for diverse products (assuming api.products.getDiverseProducts exists and returns product with store details)
  const diverseProducts = useQuery(api.products.getDiverseProducts, {
    limit: productLimit,
    storeType: filters.storeType,
    categories: filters.cuisine,
    country: country,
    region: region,
  });

  // Use the new global search if there's a search term
  const searchResults = useQuery(
    api.search.globalSearch,
    searchTerm ? { query: searchTerm, country, region } : "skip"
  );

  // Fetch stores only if there is no search term
  const { results: stores, status: storeStatus, loadMore: loadMoreStores } = usePaginatedQuery(
    api.stores.getStores,
    searchTerm
      ? "skip"
      : {
        country,
        region,
        storeType: filters.storeType,
        categories: filters.cuisine.filter((c: string) => c),
        priceRange: filters.priceRange,
        hasDelivery: filters.hasDelivery,
        sortBy: filters.sortBy,
        rating: filters.rating,
      },
    { initialNumItems: 5 }
  );

  const storeLoadMoreRef = useRef<HTMLDivElement>(null);
  const productLoadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && storeStatus === "CanLoadMore") {
        loadMoreStores(5);
      }
    });

    if (storeLoadMoreRef.current) {
      observer.observe(storeLoadMoreRef.current);
    }
    return () => observer.disconnect();
  }, [storeStatus, loadMoreStores]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setProductLimit(prev => prev + 5);
      }
    });
    if (productLoadMoreRef.current) {
      observer.observe(productLoadMoreRef.current);
    }
    return () => observer.disconnect();
  }, []);

  const hasActiveFilters =
    filters.cuisine.length > 0 ||
    !!filters.storeType ||
    filters.priceRange.length > 0 ||
    filters.hasDelivery !== undefined ||
    !!filters.sortBy;

  const isLoading = (searchTerm && searchResults === undefined) || (!searchTerm && stores === undefined);
  const displayStores = searchTerm ? searchResults?.stores : stores;
  const displayProducts = searchTerm ? searchResults?.products : [];

  if (isLoading) {
    return (
      <div className="space-y-8">
        {/* You can add skeletons for other sections like carousels if needed */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <StoreCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (!searchTerm && displayStores?.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-6">🔍</div>
        <h3 className="text-2xl font-bold text-white mb-4">No stores found</h3>
        <p className="text-gray-400 text-lg mb-8 max-w-md mx-auto">
          Try adjusting your search or filters to find more options
        </p>
        <div className="flex items-center justify-center space-x-2 text-gray-500">
          <MapPin size={16} />
          <span>{region}, {country}</span>
        </div>
      </div>
    );
  }

  const trendingStores = stores?.filter(r => r.isTrending) ?? [];
  const featuredStores = stores?.filter(r => !r.isTrending && r.hasOffer) ?? [];
  const regularStores = stores?.filter(r => !r.isTrending && !r.hasOffer) ?? [];

  return (
    <div className="space-y-8">
      {/* Search Results Section */}
      {searchTerm && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-6">Results for "{searchTerm}"</h2>
          {displayProducts && displayProducts.length > 0 && (
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-purple-400 mb-4">Products</h3>
              <div className="flex space-x-4 overflow-x-auto pb-4 -mb-4 scrollbar-hide">
              {displayProducts
              .filter((p): p is NonNullable<typeof p> => p !== null)
              .map((product) => (
                <ProductCarouselCard
                  key={product._id}
                  product={product}
                  onProductSelect={onProductSelect}
                  onStoreSelect={onStoreSelect}
                />
              ))}
              </div>
            </div>
          )}
          {displayStores && displayStores.length > 0 && (
            <div>
              <h3 className="text-xl font-semibold text-purple-400 mb-4">Stores</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayStores.map((store) => (
                  <StoreCard key={store._id} store={store} onSelect={onStoreSelect} />
                ))}
              </div>
            </div>
          )}
          {displayStores?.length === 0 && displayProducts?.length === 0 && (
            <p className="text-center text-gray-400 py-8">No stores or products found for "{searchTerm}".</p>
          )}
        </div>
      )}

      {/* Default View (No Search) */}
      {!searchTerm && (
        <>
          {/* Diverse Products Section - only show if not searching */}
          {diverseProducts && diverseProducts.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center space-x-2 mb-4 sm:mb-6">
                <Award className="text-pink-500" size={20} />
                <h2 className="text-2xl font-bold text-white">Featured Products</h2>
              </div>
              <div className="flex space-x-4 overflow-x-auto pb-4 -mb-4 scrollbar-hide">
                {diverseProducts
                  .filter((p): p is NonNullable<typeof p> => p !== null)
                  .map((product) => (
                    <ProductCarouselCard
                      key={product._id}
                      product={product}
                      onProductSelect={onProductSelect}
                      onStoreSelect={onStoreSelect}
                    />
                  ))}
                  <div ref={productLoadMoreRef} className="w-1 flex-shrink-0" />
              </div>
            </div>
          )}
          <PromotionsCarousel onStoreSelect={onStoreSelect} filters={filters} country={country} region={region} />

          {trendingStores.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center space-x-2 mb-4 sm:mb-6">
                <TrendingUp className="text-purple-500" size={20} />
                <h2 className="text-2xl font-bold text-white">Trending this week</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {trendingStores.map((store) => (
                  <StoreCard key={store._id} store={store} onSelect={onStoreSelect} />
                ))}
              </div>
            </div>
          )}

          <div className="mb-8" id="all-stores-list">
            <h2 className="text-2xl font-bold text-white mb-6">All Stores in {country}, {region}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {regularStores.map((store) => (
                <StoreCard key={store._id} store={store} onSelect={onStoreSelect} />
              ))}
            </div>
            {storeStatus === "CanLoadMore" && (
               <div ref={storeLoadMoreRef} className="flex justify-center py-4">
                 <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
               </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
