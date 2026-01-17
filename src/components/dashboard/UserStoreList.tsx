import { Doc, Id } from "../../../convex/_generated/dataModel";
import { Store as StoreIcon, ChevronRight, Soup, ShoppingCart, Pill, Power, PowerOff, Package } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

type StoreWithImageUrl = Doc<"stores"> & { imageUrl: string | null; productCount: number; };

interface UserStoreListProps {
  stores: StoreWithImageUrl[];
  onSelectStore: (store: StoreWithImageUrl) => void;
}

const getStoreIcon = (type: string) => {
  switch (type) {
    case 'restaurant': return <Soup className="w-10 h-10 text-white/80" />;
    case 'grocery': return <ShoppingCart className="w-10 h-10 text-white/80" />;
    case 'pharmacy': return <Pill className="w-10 h-10 text-white/80" />;
    default: return <StoreIcon className="w-10 h-10 text-white/80" />;
  }
};

function StoreCard({ store, onSelectStore }: { store: StoreWithImageUrl; onSelectStore: (store: StoreWithImageUrl) => void; }) {
  return (
    <div
      onClick={() => onSelectStore(store)}
      className="bg-gray-800 rounded-2xl shadow-lg cursor-pointer transition-all duration-300 hover:bg-gray-700/50 hover:shadow-purple-500/10 group flex flex-col overflow-hidden border border-gray-700 hover:border-purple-600/50"
    >
      {/* Image Section */}
      <div className="relative h-32 w-full">
        {store.imageUrl ? (
          <img src={store.imageUrl} alt={store.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
            {getStoreIcon(store.storeType)}
          </div>
        )}
        <div className={`absolute top-3 right-3 flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full backdrop-blur-sm border ${store.isOpen ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30'}`}>
          {store.isOpen ? <Power size={12} /> : <PowerOff size={12} />}
          <span>{store.isOpen ? 'Open' : 'Closed'}</span>
        </div>
      </div>

      {/* Details Section */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="text-white font-semibold text-lg line-clamp-1">{store.name}</h3>
          <p className="text-gray-400 text-sm capitalize">{store.storeType}</p>
        </div>
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Package size={16} />
            <span>{store.productCount} Products</span>
          </div>
          <div className="flex items-center gap-1 text-purple-400 font-semibold text-sm group-hover:gap-2 transition-all">
            <span>Manage</span>
            <ChevronRight size={16} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function UserStoreList({ stores, onSelectStore }: UserStoreListProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {stores.map((store) => (
        <StoreCard key={store._id} store={store} onSelectStore={onSelectStore} />
      ))}
    </div>
  );
}