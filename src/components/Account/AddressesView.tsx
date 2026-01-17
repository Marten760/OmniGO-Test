import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { ArrowLeft, Plus, Edit, Trash2, Home, Briefcase, ChevronsUpDown, Check, MapPin } from "lucide-react";
import { worldLocations } from "../../data/worldLocations";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";

const Card = ({ className, children }: { className?: string; children: React.ReactNode }) => (
    <div className={`bg-gray-800 border border-gray-700 rounded-2xl ${className}`}>{children}</div>
);
const CardContent = ({ className, children }: { className?: string, children: React.ReactNode }) => (
    <div className={className}>{children}</div>
);

function AddressForm({ initialData, onSave, onCancel }: { initialData?: any, onSave: (data: any) => void, onCancel: () => void }) {
    const [formData, setFormData] = useState({
        label: initialData?.label || '',
        address: initialData?.address || '',
        city: initialData?.city || 'New York',
        country: initialData?.country || 'United States',
        postalCode: initialData?.postalCode || '',
        latitude: initialData?.latitude || undefined,
        longitude: initialData?.longitude || undefined,
    });
    const [isCountryPopoverOpen, setIsCountryPopoverOpen] = useState(false);
    const [isRegionPopoverOpen, setIsRegionPopoverOpen] = useState(false);
    const [isLocating, setIsLocating] = useState(false);

    const handleGetCurrentLocation = () => {
        if (!navigator.geolocation) {
            toast.error("Geolocation is not supported by your browser");
            return;
        }
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setFormData(prev => ({ ...prev, latitude: position.coords.latitude, longitude: position.coords.longitude }));
                toast.success("Location detected successfully!");
                setIsLocating(false);
            },
            (error) => {
                toast.error("Unable to retrieve your location");
                setIsLocating(false);
            }
        );
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <Card className="mb-6 animate-fade-in">
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <h4 className="text-lg font-semibold text-white">{initialData ? 'Edit Address' : 'Add New Address'}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm text-gray-400">Label</label>
                        <input type="text" name="label" value={formData.label} onChange={handleInputChange} placeholder="e.g., Home, Work" required className="w-full mt-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2" />
                    </div>
                    <div>
                        <label className="text-sm text-gray-400">Postal Code</label>
                        <input type="text" name="postalCode" value={formData.postalCode} onChange={handleInputChange} className="w-full mt-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2" />
                    </div>
                </div>
                <div>
                    <label className="text-sm text-gray-400">Address</label>
                    <input type="text" name="address" value={formData.address} onChange={handleInputChange} placeholder="Street name and number" required className="w-full mt-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2" />
                </div>
                <div>
                    <Button type="button" onClick={handleGetCurrentLocation} disabled={isLocating} variant="outline" className="w-full border-purple-500/50 text-purple-400 hover:bg-purple-500/10">
                        <MapPin className="mr-2 h-4 w-4" />
                        {formData.latitude ? "Update GPS Location" : "Set GPS Location (Recommended)"}
                    </Button>
                    {formData.latitude && formData.longitude && (
                        <div className="mt-2 p-2 bg-gray-700 rounded-lg border border-gray-600 text-xs text-gray-300 flex justify-between items-center">
                            <span>📍 {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}</span>
                            <span className="text-green-400 flex items-center gap-1"><Check size={12} /> GPS Set</span>
                        </div>
                    )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm text-gray-400">Country</label>
                        <Popover open={isCountryPopoverOpen} onOpenChange={setIsCountryPopoverOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={isCountryPopoverOpen}
                                    className="w-full justify-between bg-gray-700 border-gray-600 hover:bg-gray-700 hover:border-purple-500 text-white hover:text-white mt-1"
                                >
                                    {formData.country || "Select country..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-gray-900 border-gray-700 text-white">
                                <Command className="bg-gray-900 text-white rounded-lg">
                                    <CommandInput placeholder=" Search country..." className="h-9 border-gray-700 bg-gray-800 text-white focus:ring-purple-500" />
                                    <CommandEmpty className="py-6 text-center text-sm">No country found.</CommandEmpty>
                                    <CommandGroup className="max-h-60 overflow-y-auto">
                                        {Object.keys(worldLocations).map((country) => (
                                            <CommandItem
                                                key={country}
                                                value={country}
                                                onSelect={(currentValue) => {
                                                    const newCountry = currentValue === formData.country ? "" : currentValue;
                                                    const newRegions = worldLocations[newCountry as keyof typeof worldLocations];
                                                    setFormData(prev => ({ ...prev, country: newCountry, city: newRegions?.[0] || "" }));
                                                    setIsCountryPopoverOpen(false);
                                                }}
                                                className="cursor-pointer hover:bg-purple-500/20"
                                            >
                                                <span className="truncate">{country}</span>
                                                <Check className={`ml-auto h-4 w-4 ${formData.country === country ? "opacity-100" : "opacity-0"}`} />
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>
                    <div>
                        <label className="text-sm text-gray-400">City</label>
                        <Popover open={isRegionPopoverOpen} onOpenChange={setIsRegionPopoverOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" className="w-full justify-between bg-gray-700 border-gray-600 hover:bg-gray-700 hover:border-purple-500 text-white hover:text-white mt-1" disabled={!worldLocations[formData.country as keyof typeof worldLocations]}>
                                    {formData.city || "Select region..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-gray-900 border-gray-700 text-white">
                                <Command className="bg-gray-900 text-white rounded-lg">
                                    <CommandInput placeholder=" Search region..." className="h-9 border-gray-700 bg-gray-800 text-white focus:ring-purple-500" />
                                    <CommandEmpty className="py-6 text-center text-sm">No region found.</CommandEmpty>
                                    <CommandGroup className="max-h-60 overflow-y-auto">
                                        {(worldLocations[formData.country as keyof typeof worldLocations] || []).map(region => (
                                            <CommandItem key={region} value={region} onSelect={(currentValue) => { setFormData(prev => ({ ...prev, city: currentValue })); setIsRegionPopoverOpen(false); }} className="cursor-pointer hover:bg-purple-500/20">
                                                <span className="truncate">{region}</span>
                                                <Check className={`ml-auto h-4 w-4 ${formData.city === region ? "opacity-100" : "opacity-0"}`} />
                                            </CommandItem>))}
                                    </CommandGroup>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
                <div className="flex justify-end gap-4 pt-2">
                    <Button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg">Cancel</Button>
                    <Button type="submit" className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg">Save Address</Button>
                </div>
            </form>
        </Card>
    );
}

export function AddressesView({ onBack }: { onBack: () => void }) {
    const sessionToken = useMemo(() => localStorage.getItem("sessionToken"), []);
    const addressesData = useQuery(api.addresses.getUserAddresses, sessionToken ? { tokenIdentifier: sessionToken } : "skip");
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingAddress, setEditingAddress] = useState<any>(null);

    const addAddress = useMutation(api.addresses.addAddress);
    const updateAddress = useMutation(api.addresses.updateAddress);
    const deleteAddress = useMutation(api.addresses.deleteAddress);
    const setDefaultAddress = useMutation(api.addresses.setDefaultAddress);

    // Check if user has a default address set, if not, warn them
    const hasDefaultAddress = addressesData?.defaultAddressId;
    const hasAddresses = addressesData?.addresses && addressesData.addresses.length > 0;
    const showLocationWarning = hasAddresses && !hasDefaultAddress;


    const handleSaveAddress = (addressData: any) => {
        if (!sessionToken) return;
        const promise = editingAddress
            ? updateAddress({ tokenIdentifier: sessionToken, addressId: editingAddress._id, ...addressData })
            : addAddress({ tokenIdentifier: sessionToken, ...addressData });

        toast.promise(promise, {
            loading: editingAddress ? 'Updating address...' : 'Adding address...',
            success: () => {
                setIsFormOpen(false);
                setEditingAddress(null);
                return `Address ${editingAddress ? 'updated' : 'added'} successfully!`;
            },
            error: (err) => err.data || 'Failed to save address.',
        });
    };

    const handleDelete = (addressId: Id<"userAddresses">) => {
        if (!sessionToken) return;
        toast.promise(deleteAddress({ tokenIdentifier: sessionToken, addressId }), {
            loading: 'Deleting address...',
            success: 'Address deleted.',
            error: 'Failed to delete address.',
        });
    };

    const handleSetDefault = (addressId: Id<"userAddresses">) => {
        if (!sessionToken) return;
        toast.promise(setDefaultAddress({ tokenIdentifier: sessionToken, addressId }), {
            loading: 'Setting default address...',
            success: 'Default address updated.',
            error: 'Failed to set default address.',
        });
    };

    return (
        <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                    <button onClick={onBack} className="p-2 hover:bg-gray-700 rounded-full transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                    <h3 className="text-xl font-bold text-white">My Addresses</h3>
                </div>
                <Button onClick={() => { setEditingAddress(null); setIsFormOpen(true); }} className="flex items-center gap-2 p-2 px-4 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-colors">
                    <Plus size={16} />
                    <span>Add New</span>
                </Button>
            </div>

            {showLocationWarning && (
                <div className="mb-4 p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-xl text-yellow-200 text-sm">
                    Please set a default address to ensure we can validate delivery availability for your location.
                </div>
            )}

            {isFormOpen && (
                <AddressForm
                    initialData={editingAddress}
                    onSave={handleSaveAddress}
                    onCancel={() => { setIsFormOpen(false); setEditingAddress(null); }}
                />
            )}

            <div className="space-y-4 mt-6">
                {addressesData?.addresses.map((addr: any) => (
                    <Card key={addr._id}>
                        <CardContent className="p-4 flex items-start justify-between">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
                                    {addr.label.toLowerCase() === 'home' ? <Home size={20} /> : <Briefcase size={20} />}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-semibold text-white">{addr.label}</h4>
                                        {addr._id === addressesData.defaultAddressId && (
                                            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">Default</span>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-400">{addr.address}, {addr.city}, {addr.country}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button onClick={() => handleSetDefault(addr._id)} disabled={addr._id === addressesData.defaultAddressId} variant="link" className="text-xs text-purple-400 hover:text-purple-300 disabled:opacity-50 disabled:cursor-not-allowed h-auto p-0 no-underline hover:no-underline">Set as Default</Button>
                                <Button onClick={() => { setEditingAddress(addr); setIsFormOpen(true); }} variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-white hover:bg-gray-700"><Edit size={16} /></Button>
                                <Button onClick={() => handleDelete(addr._id)} variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-500/10"><Trash2 size={16} /></Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}