import { useState } from "react";
import { Search, X } from "lucide-react";

interface SearchBarProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  country: string;
  region: string;
}

export function SearchBar({ searchTerm, onSearchChange, country, region }: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);

  const clearSearch = () => {
    onSearchChange("");
  };

  return (
    <div className="relative">
      <div className={`relative transition-all duration-300 ${isFocused ? 'transform scale-105' : ''}`}>
        <Search 
          className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 transition-colors duration-200" 
          size={20} 
        />
        <input
          type="text"
          placeholder="Search stores, products, & offers"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="w-full bg-gray-800 rounded-2xl pl-12 pr-12 py-3 sm:py-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:bg-gray-700 transition-all duration-200"
        />
        {searchTerm && (
          <button
            onClick={clearSearch}
            className="absolute right-3 sm:right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors duration-200 p-1 rounded-full hover:bg-gray-700"
          >
            <X size={16} />
          </button>
        )}
      </div>
      
      {isFocused && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 z-10 animate-slide-up">
          <div className="p-4">
            <div className="flex items-center space-x-2 text-gray-400 text-sm mb-3">
              <Search size={14} />
              <span>Searching in {region}, {country}</span>
            </div>
            <div className="space-y-2">
              <div className="text-gray-300 text-sm font-medium">Popular searches</div>
              {['Pizza', 'Sushi', 'Burgers', 'Thai food', 'Italian'].map((term) => (
                <button
                  key={term}
                  onClick={() => onSearchChange(term)}
                  className="block w-full text-left px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors duration-150"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
