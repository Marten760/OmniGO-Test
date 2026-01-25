import { useState, useMemo } from 'react';
import { Doc, Id } from '../../../convex/_generated/dataModel';
import { ArrowLeft, LayoutDashboard, Settings, ShoppingBag, Package, Trash2, AlertTriangle, Unlock, Lock, Pencil, Users, Briefcase, Link as LinkIcon, DollarSign, CheckCircle, TrendingUp } from 'lucide-react';
import { formatPiPrice } from '../../lib/utils';
import { NavigateFunction } from 'react-router-dom';
import { StoreEditForm } from './StoreEditForm';
import { StoreAnalyticsDashboard } from './StoreAnalyticsDashboard';
import { Button } from '../ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";
import { toast } from 'sonner';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { OrdersTabContent } from './OrdersTabContent';
import { DriversTabContent } from './DriversTabContent';
import { Products } from './Products';
import { InventoryTabContent } from './InventoryTabContent';
import { MarketingTabContent } from './MarketingTabContent';
import { PayoutsTabContent } from './PayoutsTabContent'; 
import { StatCard } from './StatCard';
import { ReportsTabContent } from './ReportsTabContent';

import { useAuth } from '../../hooks/useAuth';
import { usePi } from '../../hooks/usePi';
type StoreWithImageUrl = Doc<"stores"> & { imageUrl: string | null };

interface StoreManagerProps {
  store: StoreWithImageUrl;
  onBack: () => void;
  onLogout: () => void;
  navigate: NavigateFunction;
  onNavigateToChat: (conversationId: Id<"conversations">) => void;
}

const TABS = [
    { id: 'analytics', label: 'Analytics', icon: LayoutDashboard },
    { id: 'orders', label: 'Orders', icon: ShoppingBag },
    { id: 'reports', label: 'Disputes', icon: AlertTriangle },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'marketing', label: 'Marketing', icon: Package },
    { id: 'payouts', label: 'Payouts', icon: DollarSign },
    { id: 'drivers', label: 'Drivers', icon: Briefcase },
] as const;

type TabId = (typeof TABS)[number]['id'];
type View = TabId | 'edit';
export function StoreManager({ store, onBack, onLogout, navigate, onNavigateToChat }: StoreManagerProps) {
  const [activeView, setActiveView] = useState<View>('analytics');
  const { user: authUser } = useAuth();
  const { authenticate } = usePi();
  const sessionToken = useMemo(() => localStorage.getItem("sessionToken"), []);
  const toggleStoreStatus = useMutation(api.stores.toggleStoreStatus);
  const deleteStore = useMutation(api.stores.deleteStore);
  const followerCount = useQuery(
    api.follows.countFollowers,
    { storeId: store._id }
  );
  const [timeRange, setTimeRange] = useState<'7d' | '30d'>('7d');
  const dashboardSummary = useQuery(
    api.analytics.getDashboardSummary,
    sessionToken ? { storeId: store._id, tokenIdentifier: sessionToken } : "skip"
  );
  const detailedAnalytics = useQuery(
    api.analytics.getStoreAnalytics,
    sessionToken
      ? { storeId: store._id, period: timeRange === '7d' ? 'week' : 'month', tokenIdentifier: sessionToken }
      : "skip"
  );

  const isWalletLinked = !!authUser?.profile?.walletAddress;

  const stats = {
    revenue: dashboardSummary?.todayStats.revenue ?? 0,
    orders: dashboardSummary?.todayStats.orders ?? 0,
    customers: detailedAnalytics?.overview.uniqueCustomers ?? 0,
    rating: store.rating,
    inventory: dashboardSummary?.inventory.activeProducts ?? 0,
  };



  const handleToggleStatus = async (isOpen: boolean) => {
    if (!sessionToken) {
      toast.error("Authentication error. Please log in again.");
      return;
    }
    try {
      await toggleStoreStatus({ storeId: store._id, isOpen, tokenIdentifier: sessionToken });
      toast.success(`Store is now ${isOpen ? "open" : "closed"}.`);
    } catch (error) {
      toast.error("Failed to update store status.");
      console.error(error);
    }
  };

  const renderContent = () => {
    switch (activeView) {
      case 'analytics':
        return <StoreAnalyticsDashboard store={store} timeRange={timeRange} setTimeRange={setTimeRange} detailedAnalytics={detailedAnalytics} />;
      case 'orders':
        return <OrdersTabContent storeId={store._id} onNavigateToChat={onNavigateToChat} />;
      case 'reports':
        return <ReportsTabContent storeId={store._id} onNavigateToChat={onNavigateToChat} />;
      case 'products':
        return <Products storeId={store._id} />;
      case 'inventory':
        return <InventoryTabContent storeId={store._id} storeType={store.storeType} />;
      case 'marketing':
        return <MarketingTabContent storeId={store._id} />;
      case 'payouts':
        return <PayoutsTabContent storeId={store._id} />;
      case 'drivers':
        return <DriversTabContent store={store} onNavigateToChat={onNavigateToChat} />;
      case 'edit':
        return (
          <>
            <StoreEditForm store={store} />
            <div className="mt-8 pt-8 border-t border-red-500/20">
              <h3 className="text-lg font-semibold text-red-400">Danger Zone</h3>
              <p className="text-sm text-gray-400 mt-1">
                Deleting your store is a permanent action and cannot be undone.
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="mt-4">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Store
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-gray-900 border-red-500/50">
                  <AlertDialogHeader>
                    <div className="flex items-start space-x-4">
                      <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-900/50 sm:mx-0 sm:h-10 sm:w-10">
                        <AlertTriangle className="h-6 w-6 text-red-400" aria-hidden="true" />
                      </div>
                      <div className="flex-1">
                        <AlertDialogTitle className="text-xl font-bold text-white">
                          Delete Store
                        </AlertDialogTitle>
                        <AlertDialogDescription className="mt-2 text-gray-400">
                          This action cannot be undone. This will permanently delete your store and all of its associated data, including products, orders, and analytics.
                        </AlertDialogDescription>
                      </div>
                    </div>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="mt-4 sm:justify-end space-x-2">
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        if (!sessionToken) {
                          toast.error("Authentication error. Please log in again.");
                          return;
                        }
                        try {
                          await deleteStore({ storeId: store._id, tokenIdentifier: sessionToken });
                          toast.success("Store deleted successfully.");
                          onBack();
                        } catch (error: any) {
                          const errorMessage = error.data || error.message || "Failed to delete store.";
                          toast.error("Unable to delete store", {
                            description: errorMessage,
                          });
                        }
                      }}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >Yes, delete it</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between space-x-4 flex-wrap gap-y-4">
        <div className="flex items-center space-x-4">
          <button
            aria-label="Go back"
            onClick={onBack}
            className="bg-gray-800 p-3 rounded-2xl transition-all duration-200 hover:scale-110"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center space-x-4">
            {store.imageUrl && (
              <img src={store.imageUrl} alt={store.name} className="w-16 h-16 rounded-xl object-cover" />
            )}
            <div>
              <p className="text-sm text-gray-400">Managing</p>
              <h2 className="text-2xl font-bold text-white">{store.name}</h2>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-4 justify-end flex-grow">
          {isWalletLinked ? (
            <div className="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 px-3 py-2 rounded-2xl border border-green-500/30">
              <CheckCircle className="mr-2 h-4 w-4" />
              <span>Wallet Linked</span>
            </div>
          ) : ( // Wallet is not linked
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="border-yellow-500/50 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 hover:text-yellow-300 animate-pulse hover:animate-none">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Link Pi Wallet
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-gray-900 border-yellow-500/50">
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2 text-xl font-bold text-white"><LinkIcon className="h-6 w-6 text-yellow-400" />Link Your Pi Wallet</AlertDialogTitle>
                  <AlertDialogDescription className="mt-2 text-gray-400 pl-8">
                    {authUser?.profile?.piUid ? (
                      <>Your Pi account is connected, but to receive payouts for your sales, you need to link your Pi Wallet address. This is a one-time action.</>
                    ) : (
                      <>To receive payouts for your sales, you need to link your Pi account and Wallet to your OmniGo account. This is a one-time action.</>
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-4 sm:justify-end space-x-2">
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => authenticate(['username', 'payments', 'wallet_address'])} className="bg-yellow-600 hover:bg-yellow-700 text-white">Link Now</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <div className="flex items-center gap-2 text-sm text-gray-400 bg-gray-800 px-3 py-2 rounded-2xl">
            <Users size={16} />
            {followerCount === undefined ? (
              <span className="w-4 h-4 bg-gray-700 rounded-full animate-pulse"></span>
            ) : (
              <span className="font-semibold">{followerCount}</span>
            )}
            <span className="hidden sm:inline">Followers</span>
          </div>
          <Button
            onClick={() => handleToggleStatus(!store.isOpen)}
            variant="outline"
            size="sm"            className={`rounded-2xl px-4 transition-colors ${
              store.isOpen
                ? "border-green-500 bg-green-500/10 text-green-400 hover:bg-green-500/20 hover:text-green-300"
                : "border-red-500 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300"
            }`}
          >
            {store.isOpen ? <Unlock className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}
            <span>{store.isOpen ? "Open" : "Closed"}</span>
          </Button>
          <button onClick={() => setActiveView("edit")} className="bg-gray-800 p-3 rounded-2xl transition-all duration-200 hover:scale-110" aria-label="Edit store details">
            <Pencil size={20} />
          </button>
          
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Revenue"
          value={formatPiPrice(stats.revenue)}
          description=""
          icon={<DollarSign className="h-4 w-4 text-purple-400" />}
          gradient="from-purple-600/20 to-black/10"
        />
        <StatCard
          title="Orders"
          value={`${stats.orders}`}
          description=""
          icon={<Package className="h-4 w-4 text-blue-400" />}
          gradient="from-blue-500/20 to-black/10"
        />
        <StatCard
          title="Customers"
          value={`${stats.customers}`}
          description=""
          icon={<Users className="h-4 w-4 text-green-400" />}
          gradient="from-green-500/20 to-black/10"
        />
        <StatCard
          title="Inventory"
          value={`${stats.inventory}`}
          description="Active products"
          icon={<TrendingUp className="h-4 w-4 text-orange-400" />}
          gradient="from-orange-500/20 to-black/10"
        />
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id)}              className={`flex-1 py-3 px-4 rounded-2xl font-medium transition-all duration-200 flex items-center justify-center space-x-2 border transform ${
                activeView === tab.id
                  ? "bg-purple-600 text-white border-purple-500 shadow-lg" 
                  : "bg-gray-800 text-gray-400 hover:text-white border-gray-700 hover:scale-105"
              }`}
            >
              <Icon size={18} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-4 sm:p-6">
        {renderContent()}
      </div>
    </div>
  );
}