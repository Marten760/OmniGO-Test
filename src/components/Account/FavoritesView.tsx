import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Doc, Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { ArrowLeft, Heart, Star, Store, Package, Loader2, ArrowRight } from "lucide-react";
import { formatPiPrice } from "@/lib/utils";

type StoreWithUrl = Doc<"stores"> & { logoImageUrl: string | null; galleryImageUrl: string | null; };
type ProductWithUrl = Doc<"products"> & { imageUrls: (string | null)[]; storeName: string; storeId: Id<"stores">; };

interface FavoriteStoreCardProps {
  store: StoreWithUrl;
  onSelect: (storeId: Id<"stores">) => void;
}

function FavoriteStoreCard({ store, onSelect }: FavoriteStoreCardProps) {
    return (
        <div onClick={() => onSelect(store._id)} className="bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden transition-all duration-300 hover:border-purple-500/50 hover:shadow-purple-500/10 hover:-translate-y-1 cursor-pointer group">
            <div className="relative h-32 bg-gray-700">
                {store.galleryImageUrl ? (
                    <img src={store.galleryImageUrl} alt={store.name} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center"><Store size={32} className="text-gray-500" /></div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
            </div>
            <div className="p-4 relative">
                <div className="absolute -top-8 left-4 w-14 h-14 rounded-full bg-gray-700 border-4 border-gray-800 overflow-hidden flex items-center justify-center">
                    {store.logoImageUrl ? (
                        <img src={store.logoImageUrl} alt={`${store.name} logo`} className="w-full h-full object-cover" />
                    ) : (
                        <Store size={24} className="text-gray-400" />
                    )}
                </div>
                <h4 className="font-semibold text-white truncate pt-6">{store.name}</h4>
                <p className="text-sm text-gray-400 truncate">{store.categories.join(', ')}</p>
                <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-1 text-sm text-yellow-400"><Star size={14} fill="currentColor" /> {store.rating.toFixed(1)}</div>
                    <div className="flex items-center gap-1 text-sm text-purple-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        View <ArrowRight size={14} />
                    </div>
                </div>
            </div>
        </div>
    );
}

interface FavoriteProductCardProps {
  product: ProductWithUrl;
  onSelect: (product: ProductWithUrl) => void;
}

function FavoriteProductCard({ product, onSelect }: FavoriteProductCardProps) {
    return (        <div onClick={() => onSelect(product)} className="bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden transition-all duration-300 hover:border-purple-500/50 hover:shadow-purple-500/10 hover:-translate-y-1 cursor-pointer group">
            <div className="relative">
                <img src={product.imageUrls?.[0] || '/placeholder.svg'} alt={product.name} className="w-full h-32 object-cover" />
                <div className="absolute top-2 right-2 bg-red-500/50 backdrop-blur-sm p-1.5 rounded-full">
                    <Heart size={16} className="text-white" />
                </div>
            </div>
            <div className="p-4">
                <h4 className="font-semibold text-white truncate">{product.name}</h4>
                <p className="text-xs text-gray-400 truncate">from {product.storeName}</p>
                <div className="flex items-center justify-between mt-3">
                    <p className="text-sm text-purple-400 font-bold">{formatPiPrice(product.price)}</p>
                    <div className="flex items-center gap-1 text-sm text-purple-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        View <ArrowRight size={14} />
                    </div>
                </div>
            </div>
        </div>
    );
}

interface FavoritesViewProps {
    onBack: () => void;
    onStoreSelect: (storeId: Id<"stores">) => void;
    onProductSelect: (product: ProductWithUrl) => void;
}

export function FavoritesView({ onBack, onStoreSelect, onProductSelect }: FavoritesViewProps) {
    const sessionToken = useMemo(() => localStorage.getItem("sessionToken"), []);
    const [activeTab, setActiveTab] = useState<'stores' | 'products'>('stores');

    const favoriteStores = useQuery(api.storeFavorites.getFavoriteStores, sessionToken ? { tokenIdentifier: sessionToken } : "skip");
    const favoriteProducts = useQuery(api.favorites.getFavoriteProducts, sessionToken ? { tokenIdentifier: sessionToken } : "skip");

    const isLoading = favoriteStores === undefined || favoriteProducts === undefined;

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div className="flex items-center space-x-4 mb-6">
                <button onClick={onBack} className="p-2 hover:bg-gray-700 rounded-full transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <h3 className="text-xl font-bold text-white">My Library</h3>
            </div>

            {/* Tabs */}
            <div className="flex space-x-1 bg-gray-800 rounded-xl p-1 mb-8">
                <button
                    onClick={() => setActiveTab("stores")}
                    className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 ${activeTab === "stores" ? "bg-purple-600 text-white shadow-lg" : "text-gray-400 hover:text-white"}`}
                >
                    <Store size={16} /> Favorite Stores
                </button>
                <button
                    onClick={() => setActiveTab("products")}
                    className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 ${activeTab === "products" ? "bg-purple-600 text-white shadow-lg" : "text-gray-400 hover:text-white"}`}
                >
                    <Heart size={16} /> Liked Products
                </button>
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center py-20"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div>
            ) : (
                <>
                    {activeTab === 'stores' && (
                        favoriteStores && favoriteStores.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {favoriteStores.map((store) => store && <FavoriteStoreCard key={store._id} store={store as StoreWithUrl} onSelect={onStoreSelect} />)}
                            </div>
                        ) : (
                            <div className="text-center py-16 bg-gray-800/50 border border-dashed border-gray-700 rounded-2xl">
                                <Heart size={48} className="mx-auto text-gray-600 mb-4" />
                                <h3 className="text-xl font-bold text-white mb-2">You Haven't Liked Any Stores</h3>
                                <p className="text-gray-400">Tap the heart icon on a store's page to save it here.</p>
                            </div>
                        )
                    )}

                    {activeTab === 'products' && (
                        favoriteProducts && favoriteProducts.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {favoriteProducts.map((product) => product && <FavoriteProductCard key={product._id} product={product as ProductWithUrl} onSelect={onProductSelect} />)}
                            </div>
                        ) : (
                            <div className="text-center py-16 bg-gray-800/50 border border-dashed border-gray-700 rounded-2xl">
                                <Package size={48} className="mx-auto text-gray-600 mb-4" />
                                <h3 className="text-xl font-bold text-white mb-2">No Liked Products Yet</h3>
                                <p className="text-gray-400">Tap the heart icon on a product to save it here.</p>
                            </div>
                        )
                    )}
                </>
            )}
        </div>
    );
}