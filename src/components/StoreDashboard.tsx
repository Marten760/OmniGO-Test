import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Plus, Loader2 } from "lucide-react";
import { Doc, Id } from "../../convex/_generated/dataModel";
import { StoreManager } from "./dashboard/StoreManager";
import { UserStoreList } from "./dashboard/UserStoreList";
import { StoreRegistrationForm } from "./dashboard/StoreRegistrationForm";
import { NavigateFunction } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

type StoreWithImageUrl = Doc<"stores"> & { imageUrl: string | null; productCount: number; };

interface StoreDashboardProps {
  onLogout: () => void;
  navigate: NavigateFunction;
  onNavigateToChat: (conversationId: Id<"conversations">) => void;
}

function UserStoreCardSkeleton() {
  return (
    <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 bg-gray-700 rounded-lg skeleton-shimmer"></div>
        <div className="flex-1 space-y-2">
          <div className="h-5 bg-gray-700 rounded w-3/4 skeleton-shimmer"></div>
          <div className="h-4 bg-gray-700 rounded w-1/2 skeleton-shimmer"></div>
        </div>
      </div>
      <div className="mt-4 flex justify-between items-center text-sm">
        <div className="h-4 bg-gray-700 rounded w-1/4 skeleton-shimmer"></div>
        <div className="h-4 bg-gray-700 rounded w-1/4 skeleton-shimmer"></div>
      </div>
    </div>
  );
}

export function StoreDashboard({ onLogout, navigate, onNavigateToChat }: StoreDashboardProps) {
  const [showRegistrationForm, setShowRegistrationForm] = useState(false);
  const [selectedStore, setSelectedStore] = useState<StoreWithImageUrl | null>(null);
  const { sessionToken, user } = useAuth();
  const userStores = useQuery(
    api.stores.getUserStores,
    sessionToken ? { tokenIdentifier: sessionToken } : { tokenIdentifier: undefined }
  ) as StoreWithImageUrl[] | undefined;

  useEffect(() => {
    // Keep the selected store data in sync with the latest query results
    if (selectedStore && userStores) {
      const updatedData = userStores.find(r => r._id === selectedStore._id);
      if (updatedData) {
        // A simple stringify check to prevent infinite re-render loops
        if (JSON.stringify(selectedStore) !== JSON.stringify(updatedData)) {
          setSelectedStore(updatedData);
        }
      } else {
        // If the store is no longer in the list (e.g., deleted), go back.
        setSelectedStore(null);
      }
    }
  }, [userStores, selectedStore]);

  if (user === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-purple-400 animate-spin mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Loading user data...</h3>
        </div>
      </div>
    );
  }

  // Case: User is not logged in (query finished and returned null)
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="text-6xl mb-4">🔐</div>
          <h2 className="text-2xl font-bold text-white mb-2">Please sign in</h2>
          <p className="text-gray-400">You need to be signed in to manage your stores.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 text-white">
      <div>
        {!selectedStore && (
          <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">Store Management</h1>
              <p className="text-gray-400">Manage your stores and products</p>
            </div>
            
            <button
              onClick={() => setShowRegistrationForm(true)}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all duration-200 font-semibold shadow-lg hover:scale-105 active:scale-100 flex items-center space-x-2"
            >
              <Plus size={20} />
              <span>Add Store</span>
            </button>
          </div>
          
        )}

        {selectedStore ? (
          <StoreManager
            store={selectedStore}
            onLogout={onLogout}
            onBack={() => setSelectedStore(null)}
            navigate={navigate}
            onNavigateToChat={onNavigateToChat}
          />
        ) : userStores === undefined ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <UserStoreCardSkeleton key={i} />
            ))}
          </div>
        ) : userStores.length > 0 ? (
          <UserStoreList
            stores={userStores}
            onSelectStore={setSelectedStore}
          />
        ) : (
          <div className="text-center py-16 bg-gray-800/50 border border-dashed border-gray-700 rounded-2xl">
            <div className="text-6xl mb-4">🏪</div>
            <h3 className="text-2xl font-bold text-white mb-2">You haven't registered any stores yet.</h3>
            <p className="text-gray-400 mb-6">Click "Add Store" to get started.</p>
          </div>
        )}

        {/* Store Registration Modal */}
        {showRegistrationForm && <StoreRegistrationForm onClose={() => setShowRegistrationForm(false)} />}
      </div>
    </div>
  );
}
