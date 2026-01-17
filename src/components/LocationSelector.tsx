import { useState, useEffect, useMemo, useRef } from "react";
import { MapPin, Navigation, Search } from "lucide-react";
import { worldLocations, getAllCountries } from "../data/worldLocations";
import { toast } from "sonner";

interface LocationSelectorProps {
  selectedCountry: string;
  selectedRegion: string;
  onCountryChange: (country: string) => void;
  onRegionChange: (region: string) => void;
  onLocationDetect?: () => void;
}

export function LocationSelector({
  selectedCountry,
  selectedRegion,
  onCountryChange,
  onRegionChange,
  onLocationDetect
}: LocationSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCountry, setActiveCountry] = useState(selectedCountry);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const countries = useMemo(() => getAllCountries(), []);
  
  const allRegionsFlat = useMemo(() => {
    return Object.entries(worldLocations).flatMap(([country, regions]) =>
      regions.map(region => ({ region, country }))
    );
  }, []);

  const activeCountryRegions = useMemo(() => (worldLocations[activeCountry as keyof typeof worldLocations] || []), [activeCountry]);

  const filteredResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const lowercasedSearch = searchTerm.toLowerCase();
    return allRegionsFlat.filter(
      item =>
        item.region.toLowerCase().includes(lowercasedSearch) ||
        item.country.toLowerCase().includes(lowercasedSearch)
    );
  }, [searchTerm, allRegionsFlat]);

  useEffect(() => {
    if (isOpen) {
      setActiveCountry(selectedCountry);
      setSearchTerm("");
    }
  }, [selectedCountry, isOpen]);

  // Handle closing the dropdown on outside click or escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [wrapperRef]);

  const handleSelectLocation = (country: string, region: string) => {
    onCountryChange(country);
    onRegionChange(region);
    setIsOpen(false);
    setSearchTerm("");
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 bg-gray-800 hover:bg-gray-700 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl transition-colors text-white focus:outline-none focus:ring-2 focus:ring-purple-600"
      >
        <MapPin size={16} className="text-purple-400" />
        <span className="text-sm">{selectedCountry}, {selectedRegion}</span>
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 mt-2 bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 z-50 w-[95vw] max-w-md">
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Select Location</h3>
              <button
                onClick={() => toast.info("Location feature coming soon!")}
                className="flex items-center space-x-2 text-purple-400 hover:text-purple-300 transition-colors text-sm"
              >
                <Navigation size={16} />
                <span>Use my location</span>
              </button>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search countries or cities"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-xl pl-10 pr-4 py-2 text-white placeholder-gray-400 focus:border-purple-500 focus:ring-purple-500"
              />
            </div>

          </div>

          <div className="max-h-80 overflow-y-auto">
            {searchTerm.trim() ? (
              <div className="p-2">
                {filteredResults.length > 0 ? (
                  filteredResults.slice(0, 20).map(({ region, country }) => (
                    <button
                      key={`${country}-${region}`}
                      onClick={() => handleSelectLocation(country, region)}
                      className="w-full text-left px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors flex justify-between items-center"
                    >
                      <span>🏙️ {region}</span>
                      <span className="text-xs text-gray-500">{country}</span>
                    </button>
                  ))
                ) : (
                  <p className="text-center text-gray-400 py-8">No locations found.</p>
                )}
              </div>
            ) : (
              <div className="flex h-64">
                <div className="w-2/5 border-r border-gray-700 overflow-y-auto">
                  {countries.map(country => (
                    <button
                      key={country}
                      onClick={() => setActiveCountry(country)}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                        activeCountry === country
                          ? 'bg-purple-600/20 text-purple-300 font-semibold'
                          : 'text-gray-300 hover:bg-gray-700/50'
                      }`}
                    >
                      {country}
                    </button>
                  ))}
                </div>
                <div className="w-3/5 overflow-y-auto">
                  {activeCountryRegions.map(region => (
                    <button
                      key={region}
                      onClick={() => handleSelectLocation(activeCountry, region)}
                      className={`w-full text-left px-3 py-2 transition-colors ${
                        selectedCountry === activeCountry && selectedRegion === region
                          ? 'bg-purple-600 text-white font-semibold'
                          : 'text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {region}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
