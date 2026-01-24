import { Id, Doc } from "../../convex/_generated/dataModel";
import { LocationSelector } from "./LocationSelector";
import { SearchBar } from "./SearchBar";
import { FilterBar } from "./FilterBar";
import { StoreList } from "./StoreList";
import { useDebounce } from "../hooks/useDebounce";

interface HomePageProps {
  selectedCountry: string;
  setSelectedCountry: (country: string) => void;
  selectedRegion: string;
  setSelectedRegion: (region: string) => void;
  handleLocationDetect: () => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filters: {
    cuisine: string[];
    storeType: string;
    priceRange: string[];
    hasDelivery: boolean | undefined;
    sortBy: string;
    rating: number;
  };
  setFilters: (filters: HomePageProps['filters']) => void;
  setSelectedStore: (storeId: Id<"stores">) => void;
  setSelectedProduct: (product: Doc<"products"> & { storeName: string; storeId: Id<"stores">; imageUrls: (string | null)[]; }) => void;
}

export function HomePage({
  selectedCountry,
  setSelectedCountry,
  selectedRegion,
  setSelectedRegion,
  handleLocationDetect,
  searchTerm,
  setSearchTerm,
  filters,
  setFilters,
  setSelectedStore,
  setSelectedProduct,
}: HomePageProps) {
  const debouncedSearchTerm = useDebounce(searchTerm, 300); // Debounce search term by 300ms

  return (
    <div className="space-y-6">

      <div className="md:hidden">
        <LocationSelector
          selectedCountry={selectedCountry}
          selectedRegion={selectedRegion}
          onCountryChange={setSelectedCountry}
          onRegionChange={setSelectedRegion}
          onLocationDetect={handleLocationDetect}
        />
      </div>

      {/* Search Section */}
      <div className="space-y-4">
        <SearchBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          country={selectedCountry}
          region={selectedRegion}
        />
      </div>
      
      <FilterBar
        filters={filters}
        onFiltersChange={setFilters}
        selectedCountry={selectedCountry}
        selectedRegion={selectedRegion}
        onCountryChange={setSelectedCountry}
        onRegionChange={setSelectedRegion}
      />
      
      <StoreList
        country={selectedCountry}
        region={selectedRegion}
        searchTerm={debouncedSearchTerm} // Use debounced term for querying
        filters={filters}
        onStoreSelect={setSelectedStore}
        onProductSelect={setSelectedProduct} // Pass the setter for product item modal
      />
    </div>
  );
}