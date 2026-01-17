import { useState, useMemo } from "react";
import { useAction, useMutation, useConvex, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner"; 
import { Upload, Camera, Loader2, Trash2, Plus, ChevronsUpDown, Check, MapPin } from "lucide-react";
import { Reorder } from "framer-motion";
import { Button } from "../ui/button";
import { worldLocations } from "../../data/worldLocations";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "../ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { storeTypes, storeCategories } from "../../data/storeCategories";
import { OpeningHoursInput, DayHours } from './OpeningHoursInput';
import { Switch } from "../ui/switch";

interface StoreRegistrationFormProps {
  onClose: () => void;
}

export function StoreRegistrationForm({ onClose }: StoreRegistrationFormProps) {
  const regions = worldLocations;
  const registerStore = useAction(api.stores.registerStore);
  const generateUploadUrl = useMutation(api.stores.generateUploadUrl);
  const convex = useConvex();

  const sessionToken = useMemo(() => localStorage.getItem("sessionToken"), []);
  const user = useQuery(
    api.auth.getUserFromToken,
    sessionToken ? { tokenIdentifier: sessionToken } : "skip"
  );

  const initialOpeningHours: DayHours[] = [
    { day: "Sunday", isOpen: true, open: "09:00", close: "22:00" },
    { day: "Monday", isOpen: true, open: "09:00", close: "22:00" },
    { day: "Tuesday", isOpen: true, open: "09:00", close: "22:00" },
    { day: "Wednesday", isOpen: true, open: "09:00", close: "22:00" },
    { day: "Thursday", isOpen: true, open: "09:00", close: "22:00" },
    { day: "Friday", isOpen: true, open: "14:00", close: "23:00" },
    { day: "Saturday", isOpen: false, open: "09:00", close: "22:00" },
  ];

  const [formState, setFormState] = useState({
    name: "",
    description: "",
    categories: [] as string[],
    storeType: "restaurant" as "restaurant" | "pharmacy" | "grocery" | "other",
    priceRange: [] as string[],
    address: "",
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined,
    country: "United States",
    region: "New York",
    phone: "",
    email: "",
    openingHours: initialOpeningHours,
    hasDelivery: true,
    dietaryOptions: [] as string[],
    hasOffer: false,
    offerText: "",
    logoImage: null as File | null,
    galleryImages: [] as File[],
    deliveryRegions: [] as string[],
    isDeliveryRegionsAllowList: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [regionSearch, setRegionSearch] = useState("");
  const [isCountryPopoverOpen, setIsCountryPopoverOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const dietaryOptionsAvailable = [
    "Vegetarian", "Vegan", "Gluten-Free", "Halal", "Kosher", "Dairy-Free", "Nut-Free"
  ];

  const priceRangeOptions = {
    "$": "Budget", "$$": "Moderate", "$$$": "Expensive", "$$$$": "Very Expensive"
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormState(prev => ({ ...prev, [name]: checked }));
  };

  const handleCategoryToggle = (category: string) => {
    setFormState(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category]
    }));
  };

  const handleDietaryOptionToggle = (option: string) => {
    setFormState(prev => ({
      ...prev,
      dietaryOptions: prev.dietaryOptions.includes(option)
        ? prev.dietaryOptions.filter(o => o !== option)
        : [...prev.dietaryOptions, option]
    }));
  };

  const handlePriceRangeToggle = (price: string) => {
    setFormState(prev => ({
      ...prev,
      priceRange: prev.priceRange.includes(price)
        ? prev.priceRange.filter(p => p !== price)
        : [...prev.priceRange, price]
    }));
  };

  const handleDeliveryRegionToggle = (region: string) => {
    setFormState(prev => ({
      ...prev,
      deliveryRegions: prev.deliveryRegions.includes(region)
        ? prev.deliveryRegions.filter(r => r !== region)
        : [...prev.deliveryRegions, region]
    }));
  };

  const handleSingleImageUpload = async (file: File): Promise<Id<"_storage">> => {
    if (!user?.tokenIdentifier) {
      throw new Error("Authentication error: No session token found.");
    }
    const uploadUrl = await generateUploadUrl();
    const result = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!result.ok) {
      throw new Error("Failed to upload image");
    }
    const { storageId } = await result.json();
    return storageId as Id<"_storage">;
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
        toast.error("Geolocation is not supported by your browser");
        return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
        (position) => {
            setFormState(prev => ({ ...prev, latitude: position.coords.latitude, longitude: position.coords.longitude }));
            toast.success("Store location detected successfully!");
            setIsLocating(false);
        },
        (error) => {
            toast.error("Unable to retrieve location. Please allow GPS access.");
            setIsLocating(false);
        }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Enhanced validation and user check
    if (!user) {
      toast.error("Authentication session has expired. Please log in again.");
      // Potentially trigger a logout or redirect here
      return;
    }

    if (!user.tokenIdentifier) {
      toast.error("Could not verify user identity.");
      return;
    }

    const ownerId = user.tokenIdentifier; // Link the store to the user via tokenIdentifier

    if (!formState.logoImage) {
      toast.error("Please upload a store image");
      return;
    }

    // تحقق من حالة المصادقة والمستخدم
    if (!user) {
      // This check is now redundant due to the one above, but kept for safety.
      toast.error("You must be logged in to register a store.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Upload images in parallel for better performance
      const logoImageId = await handleSingleImageUpload(formState.logoImage);
      const galleryImageIds = await Promise.all(
        formState.galleryImages.map(file => handleSingleImageUpload(file))
      );

      const { logoImage, galleryImages, ...formDataForMutation } = formState;

      await registerStore({
        ...formDataForMutation,
        logoImageId,
        galleryImageIds,
        ownerId,
      });
      toast.success("Store registered successfully!");
      onClose();
    } catch (error) {
      console.error("Registration error:", error);
      toast.error("Failed to register store. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (user === undefined) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-700 flex items-center justify-center">
          <Loader2 className="w-12 h-12 text-purple-400 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-700 mx-4">
        <h2 className="text-2xl font-bold text-white mb-6">Register New Store</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Logo Image Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Store Logo *</label>
            <div className="border-2 border-dashed border-gray-600 rounded-xl p-6 text-center">
              {formState.logoImage ? (
                <div className="space-y-2">
                  <img src={URL.createObjectURL(formState.logoImage)} alt="Preview" className="w-32 h-32 object-cover rounded-lg mx-auto" />
                  <p className="text-green-400 text-sm">{formState.logoImage.name}</p>
                  <button type="button" onClick={() => setFormState({ ...formState, logoImage: null })} className="text-red-400 hover:text-red-300 text-sm">Remove</button>
                </div>
              ) : (
                <div>
                  <Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-400 mb-2">Upload store image</p>
                  <input type="file" accept="image/*" onChange={(e) => setFormState({ ...formState, logoImage: e.target.files?.[0] || null })} className="hidden" id="restaurant-image" required />
                  <label htmlFor="restaurant-image" className="bg-purple-600 hover:bg-purple-700 text-white p-4 rounded-2xl cursor-pointer inline-flex items-center justify-center space-x-2">
                    <Upload size={16} />
                    <span>Choose Image</span>
                  </label>
                </div>
              )}
            </div>
          </div>
          {/* Gallery Images Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Gallery Images (Optional)</label>
            <div className="border-2 border-dashed border-gray-600 rounded-xl p-4">
              {formState.galleryImages.length > 0 ? (                
                <Reorder.Group
                  axis="x"
                  values={formState.galleryImages}
                  onReorder={(newOrder) => setFormState(prev => ({ ...prev, galleryImages: newOrder }))}
                  className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3"
                >
                  {formState.galleryImages.map((image, index) => (
                    <Reorder.Item key={image.name + index} value={image} className="relative group aspect-square cursor-grab">
                      <img src={URL.createObjectURL(image)} alt={`Preview ${index + 1}`} className="w-full h-full object-cover rounded-lg" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button type="button" onClick={() => setFormState(prev => ({ ...prev, galleryImages: prev.galleryImages.filter((_, i) => i !== index) }))} className="text-white p-1 bg-red-600/80 rounded-full">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </Reorder.Item>
                  ))}
                  <label htmlFor="gallery-images" className="flex items-center justify-center aspect-square border-2 border-dashed border-gray-500 rounded-lg cursor-pointer hover:bg-gray-700/50">
                    <Plus size={24} className="text-gray-400" />
                  </label>
                </Reorder.Group>
              ) : ( 
                <div className="text-center p-6">
                  <Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-400 mb-2">Drag & drop images here, or click to upload</p>
                  <label htmlFor="gallery-images" className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg cursor-pointer inline-flex items-center space-x-2">
                    <Upload size={18} />
                    <span>Choose Images</span>
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Name and Cuisine */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">Store Name *</label>
              <input type="file" accept="image/*" multiple onChange={(e) => setFormState(prev => ({ ...prev, galleryImages: [...prev.galleryImages, ...Array.from(e.target.files || [])] }))} className="hidden" id="gallery-images" />
              <input type="text" name="name" required value={formState.name} onChange={handleInputChange} className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white focus:border-purple-500 focus:ring-purple-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Store Type *</label>
              <Select
                required
                value={formState.storeType}
                onValueChange={(value) => handleInputChange({ target: { name: 'storeType', value } } as React.ChangeEvent<HTMLSelectElement>)}
              >
                <SelectTrigger className="w-full bg-gray-700 border-gray-600 rounded-xl px-4 py-2 text-white focus:border-purple-500 focus:ring-purple-500 capitalize">
                  <SelectValue placeholder="Select a store type" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 text-white">
                  {Object.entries(storeTypes).map(([key, value]) => (
                    <SelectItem key={key} value={key} className="capitalize cursor-pointer hover:bg-purple-500/20">{value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Categories * <span className="text-xs text-gray-400">(select all that apply)</span></label>
            <div className="flex flex-wrap gap-2 p-3 bg-gray-900/50 border border-gray-700 rounded-xl">
              {(storeCategories[formState.storeType as keyof typeof storeCategories] || []).map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleCategoryToggle(cat)}
                  className={`px-4 py-2 rounded-full text-sm transition-all duration-200 ${
                    formState.categories.includes(cat)
                      ? 'bg-purple-600 text-white shadow-lg'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>


          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Description *</label>
            <textarea name="description" required value={formState.description} onChange={handleInputChange} className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white focus:border-purple-500 focus:ring-purple-500" rows={3} />
          </div>

          {/* Location */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Country *</label>
              <Popover open={isCountryPopoverOpen} onOpenChange={setIsCountryPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={isCountryPopoverOpen}
                    className="w-full justify-between bg-gray-700 border-gray-600 hover:bg-gray-700 hover:border-purple-500 text-white hover:text-white"
                  >
                    {formState.country || "Select country..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-gray-900 border-gray-700 text-white" >
                  <Command className="bg-gray-900 text-white rounded-lg">
                    <CommandInput placeholder=" Search country..." className="h-9 border-gray-700 bg-gray-800 text-white focus:ring-purple-500" />
                    <CommandEmpty className="py-6 text-center text-sm">No country found.</CommandEmpty>
                    <CommandGroup className="max-h-60 overflow-y-auto">
                      {Object.keys(regions).map((country) => (
                        <CommandItem
                          key={country}
                          value={country}
                          onSelect={(currentValue: string) => {
                            const newCountry = currentValue === formState.country ? "" : currentValue;
                            const newRegions = regions[newCountry as keyof typeof regions];
                            setFormState(prev => ({ ...prev, country: newCountry, region: newRegions ? newRegions[0] : "" }));
                            setIsCountryPopoverOpen(false);
                          }}
                          className="cursor-pointer hover:bg-purple-500/20" >
                          <span className="truncate">{country}</span>
                          <Check className={`ml-auto h-4 w-4 ${formState.country === country ? "opacity-100" : "opacity-0"}`} />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Region/City *</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between bg-gray-700 border-gray-600 hover:bg-gray-700 hover:border-purple-500 text-white hover:text-white" disabled={!regions[formState.country as keyof typeof regions]}>
                    {formState.region || "Select region..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-gray-900 border-gray-700 text-white">
                  <Command className="bg-gray-900 text-white rounded-lg">
                    <CommandInput placeholder=" Search region..." className="h-9 border-gray-700 bg-gray-800 text-white focus:ring-purple-500" />
                    <CommandEmpty className="py-6 text-center text-sm">No region found.</CommandEmpty>
                    <CommandGroup className="max-h-60 overflow-y-auto">
                      {(regions[formState.country as keyof typeof regions] || []).map(region => (
                        <CommandItem 
                          key={region} 
                          value={region} 
                          onSelect={(currentValue: string) => { setFormState(prev => ({ ...prev, region: currentValue })); }}
                          className="cursor-pointer hover:bg-purple-500/20">
                            <span className="truncate">{region}</span>
                            <Check className={`ml-auto h-4 w-4 ${formState.region === region ? "opacity-100" : "opacity-0"}`} />
                        </CommandItem>))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Delivery Zones */}
          {formState.hasDelivery && (
            <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-white font-medium">Delivery Zones</h4>
                  <p className="text-sm text-gray-400">Restrict delivery to specific areas in {formState.country || "your country"}.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${!formState.isDeliveryRegionsAllowList ? "text-white font-bold" : "text-gray-400"}`}>Block Selected</span>
                  <Switch
                    checked={formState.isDeliveryRegionsAllowList}
                    onCheckedChange={(checked) => setFormState(prev => ({ ...prev, isDeliveryRegionsAllowList: checked }))}
                    className="data-[state=checked]:bg-purple-600 data-[state=unchecked]:bg-gray-600"
                  />
                  <span className={`text-sm ${formState.isDeliveryRegionsAllowList ? "text-white font-bold" : "text-gray-400"}`}>Allow Selected</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 bg-gray-900 rounded-lg">
                {(worldLocations[formState.country as keyof typeof worldLocations] || []).map(region => (
                  <button
                    key={region}
                    type="button"
                    onClick={() => handleDeliveryRegionToggle(region)}
                    className={`px-3 py-1.5 rounded-full text-xs transition-all duration-200 border ${
                      formState.deliveryRegions.includes(region)
                        ? 'bg-purple-600 border-purple-500 text-white'
                        : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-gray-500'
                    }`}
                  >
                    {region}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Address *</label>
            <div className="mb-2">
                <Button type="button" onClick={handleGetCurrentLocation} disabled={isLocating} variant="outline" className="w-full border-purple-500/50 text-purple-400 hover:bg-purple-500/10">
                    <MapPin className="mr-2 h-4 w-4" />
                    {formState.latitude ? "Update GPS Location" : "Set GPS Location (Recommended)"}
                </Button>
                {formState.latitude && formState.longitude && (
                  <div className="mt-2 p-2 bg-gray-800 rounded-lg border border-gray-700 text-xs text-gray-300 flex justify-between items-center">
                      <span>📍 {formState.latitude.toFixed(6)}, {formState.longitude.toFixed(6)}</span>
                      <span className="text-green-400 flex items-center gap-1"><Check size={12} /> GPS Set</span>
                  </div>
                )}
            </div>
            <input type="text" name="address" required value={formState.address} onChange={handleInputChange} className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white focus:border-purple-500 focus:ring-purple-500" />
          </div>

          {/* Contact & Hours */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Phone</label>
              <input type="tel" name="phone" value={formState.phone} onChange={handleInputChange} className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white focus:border-purple-500 focus:ring-purple-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
              <input type="email" name="email" value={formState.email} onChange={handleInputChange} className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white focus:border-purple-500 focus:ring-purple-500" />
            </div>
          </div>
          <OpeningHoursInput value={formState.openingHours} onChange={(newHours) => setFormState(prev => ({ ...prev, openingHours: newHours }))} />

          {/* Price & Delivery */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Price Range</label>
              <div className="flex flex-wrap gap-2 p-3 bg-gray-900/50 border border-gray-700 rounded-xl">
                {Object.entries(priceRangeOptions).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handlePriceRangeToggle(value)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-all duration-200 ${
                      formState.priceRange.includes(value)
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {value} - {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-end">
              <div className="flex items-center space-x-3">
                <input type="checkbox" id="hasDelivery" name="hasDelivery" checked={formState.hasDelivery} onChange={handleCheckboxChange} className="w-5 h-5 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500" />
                <label htmlFor="hasDelivery" className="text-gray-300">Offers delivery service</label>
              </div>
            </div>
          </div>

          {formState.hasDelivery && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            </div>
          )}

          

          {/* Offers */}
          <div>
            <div className="flex items-center space-x-3 mb-3">
              <input type="checkbox" id="hasOffer" name="hasOffer" checked={formState.hasOffer} onChange={handleCheckboxChange} className="w-5 h-5 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500" />
              <label htmlFor="hasOffer" className="text-gray-300">This Store has a special offer</label>
            </div>
            {formState.hasOffer && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Offer Text *</label>
                <input type="text" name="offerText" required={formState.hasOffer} placeholder="e.g., 20% off on all pizzas" value={formState.offerText} onChange={handleInputChange} className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white focus:border-purple-500 focus:ring-purple-500" />
              </div>
            )}
          </div>


          {/* Submit Buttons */}
          <div className="flex justify-end space-x-4 pt-4">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-xl transition-colors disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl transition-all duration-200 font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
              {isSubmitting ? "Registering..." : "Register Store"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}