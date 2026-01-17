import { worldLocations, getAllCountries } from "../data/worldLocations";

interface RegionSelectorProps {
  selectedCountry: string;
  selectedRegion: string;
  onCountryChange: (country: string) => void;
  onRegionChange: (region: string) => void;
}

export function RegionSelector({
  selectedCountry,
  selectedRegion,
  onCountryChange,
  onRegionChange,
}: RegionSelectorProps) {
  const countries = getAllCountries();
  const availableRegions = worldLocations[selectedCountry as keyof typeof worldLocations] || [];

  const handleCountryChange = (country: string) => {
    onCountryChange(country);
    const firstRegion = worldLocations[country as keyof typeof worldLocations]?.[0];
    if (firstRegion) {
      onRegionChange(firstRegion);
    }
  };

  return (
    <div className="flex space-x-2">
      <select
        value={selectedCountry}
        onChange={(e) => handleCountryChange(e.target.value)}
        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-violet focus:border-transparent bg-white text-sm"
      >
        {countries.map((country) => (
          <option key={country} value={country}>
            {country}
          </option>
        ))}
      </select>
      
      <select
        value={selectedRegion}
        onChange={(e) => onRegionChange(e.target.value)}
        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-violet focus:border-transparent bg-white text-sm"
      >
        {availableRegions.map((region) => (
          <option key={region} value={region}>
            {region}
          </option>
        ))}
      </select>
    </div>
  );
}
