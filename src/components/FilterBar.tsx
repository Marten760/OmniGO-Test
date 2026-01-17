import { useState, useMemo } from "react";
import { Filter, X, Star, DollarSign, Truck, Clock, MapPin, Store, Soup, ShoppingCart, Pill } from "lucide-react";
import { worldLocations } from "../data/worldLocations";
import { storeTypes, storeCategories } from "../data/storeCategories";

interface FilterBarProps {
  filters: {
    cuisine: string[]; // Changed to array to support multi-select
    storeType: string | undefined;
    priceRange: string[];
    hasDelivery: boolean | undefined;
    sortBy: string;
    rating: number;
  };
  onFiltersChange: (filters: any) => void;
  selectedCountry: string;
  selectedRegion: string;
  onCountryChange: (country: string) => void;
  onRegionChange: (region: string) => void;
}

export function FilterBar({
  filters, onFiltersChange, selectedCountry, selectedRegion, onCountryChange, onRegionChange
}: FilterBarProps) {
  const [showFilters, setShowFilters] = useState(false);

  const priceRanges = [
    { value: "$", label: "Budget-friendly" },
    { value: "$$", label: "Moderate" },
    { value: "$$$", label: "Expensive" },
    { value: "$$$$", label: "Very Expensive" }
  ];
  const sortOptions = [
    { value: "", label: "Recommended" },
    { value: "rating", label: "Highest rated" },
    { value: "delivery_time", label: "Fastest delivery" },
    { value: "price_low", label: "Price: Low to high" },
    { value: "price_high", label: "Price: High to low" }
  ];

  const countries = Object.keys(worldLocations);
  const regions = worldLocations;

  const quickFilters = [
    { key: 'all', label: 'All', active: !filters.cuisine && !filters.priceRange && filters.hasDelivery === undefined },
    { key: 'delivery', label: 'Delivery', active: filters.hasDelivery === true },
    { key: 'rating', label: 'Top Rated', active: filters.sortBy === 'rating' },
    
  ];
  
  const handleQuickFilter = (key: string) => {
    switch (key) {
      case 'all':
        clearAllFilters(); // Use the existing clear function for consistency and correctness
        break;
      case 'delivery':
        onFiltersChange({ ...filters, hasDelivery: filters.hasDelivery === true ? undefined : true });
        break;
      case 'rating':
        onFiltersChange({ ...filters, sortBy: filters.sortBy === 'rating' ? '' : 'rating' });
        break;
      case 'fast':
        onFiltersChange({ ...filters, sortBy: filters.sortBy === 'delivery_time' ? '' : 'delivery_time' });
        break;
    }
  };

  const clearAllFilters = () => {
    onFiltersChange({
      cuisine: [],
      storeType: "",
      priceRange: [],
      hasDelivery: undefined,
      sortBy: "",
      rating: 0,
    });
    setShowFilters(false);
  };

  const handleCuisineToggle = (cuisine: string) => {
    const newCuisines = filters.cuisine.includes(cuisine)
      ? filters.cuisine.filter(c => c !== cuisine)
      : [...filters.cuisine, cuisine];
    onFiltersChange({ ...filters, cuisine: newCuisines });
  };

  const handlePriceRangeToggle = (price: string) => {
    const newPriceRanges = filters.priceRange.includes(price)
      ? filters.priceRange.filter(p => p !== price)
      : [...filters.priceRange, price];
    onFiltersChange({ ...filters, priceRange: newPriceRanges });
  };


  const hasActiveFilters =
    filters.cuisine.length > 0 ||
    filters.storeType ||
    filters.priceRange.length > 0 ||
    filters.hasDelivery !== undefined ||
    filters.sortBy ||
    filters.rating > 0;

  const dynamicCategories = useMemo(() => {
    if (filters.storeType && storeCategories[filters.storeType as keyof typeof storeCategories]) {
      return storeCategories[filters.storeType as keyof typeof storeCategories];
    }
    return [];
  }, [filters.storeType]);

  return (
    <div className="space-y-4">
      {/* Quick Filters */}
      <div className="flex space-x-2 sm:space-x-3 overflow-x-auto pb-2 scrollbar-hide">
        {quickFilters.map(filter => (
          <button
            key={filter.key}
            onClick={() => handleQuickFilter(filter.key)}
            className={`px-3 py-1.5 sm:px-4 sm:py-2 text-sm rounded-full whitespace-nowrap transition-all duration-200 transform ${
              filter.active 
                ? 'bg-purple-600 text-white shadow-lg transform scale-105' 
                : 'bg-gray-800 text-gray-300 hover:text-white hover:scale-105'
            }`}
          >
            {filter.label}
          </button>
        ))}
        
        <button 
          onClick={() => setShowFilters(true)}
          className={`flex items-center space-x-2 px-3 py-1.5 sm:px-4 sm:py-2 text-sm rounded-full whitespace-nowrap transition-all duration-200 transform ${
            hasActiveFilters
              ? 'bg-purple-600 text-white shadow-lg'
              : 'bg-gray-800 text-gray-300 hover:text-white hover:scale-105'
          }`}
        >
          <Filter size={16} />
          <span>More Filters</span>
          {hasActiveFilters && (
            <span className="bg-white text-purple-600 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
              !
            </span>
          )}
        </button>
      </div>

      {/* Advanced Filters Modal */}
      {showFilters && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end animate-fade-in">
          <div className="bg-gray-900 w-full max-h-[80vh] rounded-t-3xl p-6 overflow-y-auto animate-slide-up scrollbar-hide">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white text-2xl font-bold">Filters</h2>
              <button 
                onClick={() => setShowFilters(false)} 
                className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6">

              {/* Location Section */}
              <div>
                <h3 className="text-white text-lg font-semibold mb-3 flex items-center space-x-2">
                  <MapPin size={20} />
                  <span>Location</span>
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Country</label>
                    <select
                      value={selectedCountry}
                      onChange={(e) => {
                        onCountryChange(e.target.value);
                        onRegionChange(regions[e.target.value as keyof typeof regions]?.[0] || "");
                      }}
                      className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-white focus:border-purple-500 focus:ring-purple-500"
                    >
                      {countries.map(country => <option key={country} value={country}>{country}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">City/Region</label>
                    <select
                      value={selectedRegion}
                      onChange={(e) => onRegionChange(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-white focus:border-purple-500 focus:ring-purple-500"
                    >
                      {(regions[selectedCountry as keyof typeof regions] || []).map(region => <option key={region} value={region}>{region}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Store Type Filter */}
              <div>
                <h3 className="text-white text-lg font-semibold mb-3 flex items-center space-x-2">
                  <Store size={20} />
                  <span>Store Type</span>
                </h3>
                <div className="space-y-2">
                  {Object.entries(storeTypes).map(([key, label]) => {
                    return (
                    <button
                      key={key}
                      onClick={() => onFiltersChange({ ...filters, storeType: filters.storeType === key ? undefined : key, cuisine: [] })} // Reset cuisine on type change
                      className={`w-full p-3 rounded-xl border flex items-center justify-start gap-3 transition-all duration-200 ${
                        filters.storeType === key ? 'border-purple-600 bg-purple-600/20 text-white shadow-lg' : 'border-gray-600 text-gray-300 hover:border-gray-500 hover:bg-gray-800'
                      }`}
                    >
                      <span className="font-semibold">{label}</span>
                    </button>
                    );
                  })}
                </div>
              </div>
              
              {/* Cuisine Filter */}
              <div>
                <h3 className={`text-white text-lg font-semibold mb-3 flex items-center space-x-2 transition-opacity ${!filters.storeType ? 'opacity-50' : ''}`}>
                  <span>🍽️</span>
                  <span>Categories</span>
                </h3>
                <div className={`flex flex-wrap gap-2 transition-opacity ${!filters.storeType ? 'opacity-50 pointer-events-none' : ''}`}>
                  {!filters.storeType && <p className="text-sm text-gray-500">Select a store type to see categories.</p>}
                  {dynamicCategories.map(category => (
                    <button
                      key={category}
                      onClick={() => handleCuisineToggle(category)}
                      className={`px-4 py-2 rounded-full text-sm transition-all duration-200 ${
                        filters.cuisine.includes(category)
                          ? 'bg-purple-600 text-white shadow-lg transform scale-105'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price Range Filter */}
              <div>
                <h3 className="text-white text-lg font-semibold mb-3 flex items-center space-x-2">
                  <DollarSign size={20} />
                  <span>Price Range</span>
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {priceRanges.map(range => (
                    <button
                      key={range.value}
                      onClick={() => handlePriceRangeToggle(range.value)}
                      className={`p-4 rounded-xl border transition-all duration-200 ${
                        filters.priceRange.includes(range.value)
                          ? 'border-purple-600 bg-purple-600/20 text-white shadow-lg'
                          : 'border-gray-600 text-gray-300 hover:border-gray-500 hover:bg-gray-800'
                      }`}
                    >
                      <div className="font-bold text-lg">{range.value}</div>
                      <div className="text-sm opacity-75">{range.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Delivery Filter */}
              <div>
                <h3 className="text-white text-lg font-semibold mb-3 flex items-center space-x-2">
                  <Truck size={20} />
                  <span>Delivery Options</span>
                </h3>
                <button
                  onClick={() => onFiltersChange({
                    ...filters,
                    hasDelivery: filters.hasDelivery === true ? undefined : true
                  })}
                  className={`w-full p-4 rounded-xl border transition-all duration-200 ${
                    filters.hasDelivery === true
                      ? 'border-purple-600 bg-purple-600/20 text-white shadow-lg'
                      : 'border-gray-600 text-gray-300 hover:border-gray-500 hover:bg-gray-800'
                  }`}
                >
                  <div className="flex items-center justify-center space-x-2">
                    <Truck size={20} />
                    <span>Delivery Available</span>
                  </div>
                </button>
              </div>

              {/* Sort Options */}
              <div>
                <h3 className="text-white text-lg font-semibold mb-3 flex items-center space-x-2">
                  <Star size={20} />
                  <span>Sort By</span>
                </h3>
                <div className="space-y-2">
                  {sortOptions.map(option => (
                    <button
                      key={option.value}
                      onClick={() => onFiltersChange({
                        ...filters,
                        sortBy: filters.sortBy === option.value ? "" : option.value
                      })}
                      className={`w-full p-3 rounded-xl text-left transition-all duration-200 ${
                        filters.sortBy === option.value
                          ? 'bg-purple-600 text-white shadow-lg'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              

              {/* Rating */}
              <div>
                <h3 className="text-white text-lg font-semibold mb-3 flex items-center space-x-2">
                  <Star size={20} />
                  <span>Minimum Rating</span>
                </h3>
                <div className="flex flex-wrap gap-2">
                  {[4.5, 4.0, 3.5, 3.0, 0].map(rating => (
                    <button
                      key={rating}
                      onClick={() => onFiltersChange({ ...filters, rating: filters.rating === rating ? 0 : rating })}
                      className={`px-4 py-2 rounded-xl border transition-all duration-200 ${
                        filters.rating === rating ? 'border-purple-600 bg-purple-600/20 text-white' : 'border-gray-600 text-gray-300 hover:border-gray-500'
                      }`}
                    >{rating > 0 ? `${rating}+ ⭐` : 'Any'}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex space-x-3 mt-8">
              <button 
                onClick={clearAllFilters}
                className="flex-1 bg-gray-800 text-white py-4 rounded-2xl font-semibold hover:bg-gray-700 transition-colors"
              >
                Clear All
              </button>
              <button 
                onClick={() => setShowFilters(false)}
                className="flex-1 bg-purple-600 text-white py-4 rounded-2xl font-semibold hover:bg-purple-700 transition-colors shadow-lg"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
