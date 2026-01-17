import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";import { Doc, Id } from "../../convex/_generated/dataModel";
import { useAuth } from "../hooks/useAuth";
import { SignOutButton } from "../SignOutButton";
import { 
  ChevronRight,
  User,
  Settings,
  HelpCircle,
  MapPin,
  CreditCard,
  Bell,
  Star,
  Receipt,
  Heart,
  LogOut,
  FileText,
  ShieldCheck,
  Pi,
  Wallet,
  LayoutDashboard,
  Truck,
  Loader2,
} from "lucide-react";
import {
  CardHeader,
  CardTitle,
  CardDescription,
} from "./ui/card";
import { ProfileInformationView } from "./Account/ProfileInformationView";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { AddressesView } from "./Account/AddressesView";
import { NotificationsView } from "./Account/NotificationsView";
import { FavoritesView } from "./Account/FavoritesView";
import { ReviewsView } from "./Account/ReviewsView";
import { HelpAndSupportView } from "./Account/HelpAndSupportView";
import { SettingsView } from "./Account/SettingsView";
import { toast } from "sonner";

const Card = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div className={`bg-gray-800 border border-gray-700 rounded-2xl ${className}`}>{children}</div>
);
const CardContent = ({ className, children }: { className?: string, children: React.ReactNode }) => (
  <div className={className}>{children}</div>
);
const Button = ({ onClick, className, children, disabled, type }: { onClick?: () => void, className?: string, children: React.ReactNode, disabled?: boolean, type?: "submit" | "button" | "reset" }) => (
  <button onClick={onClick} className={className} disabled={disabled} type={type}>{children}</button>
);

type AccountPageProps = {
  setCurrentView: (view: string) => void;
  setSelectedStore: (storeId: Id<"stores">) => void;
  setSelectedProduct: (product: Doc<"products"> & { storeName: string; storeId: Id<"stores">; imageUrls: (string | null)[]; }) => void;
  onLogout: () => void;
};

export function AccountPage({ setCurrentView, setSelectedStore, setSelectedProduct, onLogout }: AccountPageProps) {
  const { sessionToken, user } = useAuth();
  const orderStats = useQuery(api.orders.getUserOrderStats, sessionToken ? { tokenIdentifier: sessionToken } : "skip");
  const avgRating = useQuery(api.reviews.getUserAverageRating, sessionToken ? { tokenIdentifier: sessionToken } : "skip");
  const hasStore = useQuery(api.stores.checkUserHasStore, sessionToken ? { tokenIdentifier: sessionToken } : "skip");
  const [activeSubView, setActiveSubView] = useState<'main' | 'profile' | 'addresses' | 'paymentMethods' | 'notifications' | 'favorites' | 'reviews' | 'help' | 'settings'>('main');
  const setActiveRole = useMutation(api.auth.setActiveRole);
  const [isTogglingRole, setIsTogglingRole] = useState(false);
  const updateUserProfile = useMutation(api.auth.updateUserProfile);

  const displayName = [user?.profile?.firstName, user?.profile?.lastName].filter(Boolean).join(' ') || user?.name || user?.profile?.piUsername || 'User';
  const isDriver = user?.profile?.roles?.includes('driver');
  const isDriverModeActive = isDriver && user?.profile?.activeRole === 'driver';

  const handleRoleToggle = async (isActive: boolean) => {
    if (!sessionToken) return;
    setIsTogglingRole(true);
    const newRole = isActive ? 'driver' : 'customer';
    try {
      await setActiveRole({ tokenIdentifier: sessionToken, role: newRole });
      toast.success(`Switched to ${newRole} mode.`);
      // Instead of reloading, navigate to the correct view.
      // The UI will reactively update based on the new role.
      setCurrentView(newRole === 'driver' ? 'delivery' : 'home');
    } catch (error: any) {
      toast.error("Failed to switch mode", {
        description: error.data?.message || error.message,
      });
    } finally {
      setIsTogglingRole(false);
    }
  };
  
  const menuItems = useMemo(() => {
    return [
      { icon: User, title: "Profile Information", description: "Update your personal details", action: () => setActiveSubView('profile') },
      { icon: Bell, title: "Notifications", description: "Order updates and promotions", action: () => setActiveSubView('notifications') },
      { icon: MapPin, title: "Addresses", description: "Manage delivery locations", action: () => setActiveSubView('addresses') },
      { icon: Heart, title: "Favorites", description: "Your saved stores", action: () => setActiveSubView('favorites') },
      { icon: Star, title: "Reviews & Ratings", description: "Your store reviews", action: () => setActiveSubView('reviews') },
      { icon: Receipt, title: "Order History", description: "View past orders", action: () => setCurrentView("orders") },
      { icon: LayoutDashboard, title: "Store Dashboard", description: "Manage your store or create a new one", action: () => setCurrentView('dashboard') },
      { icon: FileText, title: "Privacy Policy", description: "How we handle your data", action: () => setCurrentView("privacy") },
      { icon: ShieldCheck, title: "Terms of Service", description: "Our terms and conditions", action: () => setCurrentView("terms") },
      { icon: Settings, title: "Settings", description: "App preferences", action: () => setActiveSubView('settings') }
    ];
  }, [setActiveSubView, setCurrentView]);

  // Loading state while user data is being fetched
  if (user === undefined) {
    return (
      <div className="animate-pulse">
        <div className="pb-6">
          <div className="bg-gray-800 rounded-2xl h-[124px] p-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gray-700 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-6 bg-gray-700 rounded w-3/4"></div>
                <div className="h-4 bg-gray-700 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        </div>
        <div className="pb-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-800 rounded-2xl aspect-square"></div>
            <div className="bg-gray-800 rounded-2xl aspect-square"></div>
            <div className="bg-gray-800 rounded-2xl aspect-square"></div>
          </div>
        </div>
      </div>
    );
  }

  if (activeSubView === 'profile') {
    return (
      <div className="space-y-6">
        <ProfileInformationView user={user} onBack={() => setActiveSubView('main')} />
        
        {/* Manual Wallet Input Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Wallet size={20} /> Pi Wallet Address</CardTitle>
            <CardDescription>
              If your wallet address was not detected automatically, you can enter it here. This is required for store payouts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!sessionToken) return;
              const formData = new FormData(e.currentTarget);
              const walletAddress = formData.get("walletAddress") as string;

              if (walletAddress && !walletAddress.startsWith('G')) {
                toast.error('Invalid Pi address. It must start with a "G".');
                return;
              }
              try {
                await updateUserProfile({ 
                  tokenIdentifier: sessionToken, 
                  piWalletAddress: walletAddress || undefined // Pass undefined if empty to clear it
                });
                toast.success('Wallet address updated!');
              } catch (err: any) {
                toast.error('Update failed: ' + (err.data?.message || err.message));
              }
            }}>
              <input id="walletAddress" name="walletAddress" type="text" placeholder="G..." defaultValue={user?.profile?.walletAddress || ''} className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 text-white mb-4" />
              <Button type="submit" className="w-full bg-purple-600 text-white p-2 rounded-lg hover:bg-purple-700">Save Wallet Address</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (activeSubView === 'addresses') {
    return <AddressesView onBack={() => setActiveSubView('main')} />;
  }

  if (activeSubView === 'notifications') {
    return <NotificationsView onBack={() => setActiveSubView('main')} />
  }

  if (activeSubView === 'favorites') {
    return <FavoritesView 
      onBack={() => setActiveSubView('main')} 
      onStoreSelect={setSelectedStore}
      onProductSelect={setSelectedProduct}
    />
  }

  if (activeSubView === 'reviews') {
    return <ReviewsView onBack={() => setActiveSubView('main')} />
  }

  if (activeSubView === 'help') {
    return <HelpAndSupportView onBack={() => setActiveSubView('main')} />;
  }

  if (activeSubView === 'settings') {
    return <SettingsView onBack={() => setActiveSubView('main')} onLogout={onLogout} />
  }

  return (
    <div className="bg-gray-900 text-white flex flex-col flex-1">

      {/* Profile Header */}
      <div className="pb-6">
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center ring-4 ring-white/10 overflow-hidden">
                {user?.profile?.profileImageUrl ? (
                  <img src={user.profile.profileImageUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : user?.profile?.piUid ? (
                  <Pi size={32} className="text-white" />
                ) : (
                  <User className="h-8 w-8 text-white" />
                )}
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-white">{displayName}</h2>
                <p className="text-sm text-white/80">{user?.email ?? 'No email provided'}</p>
              </div>
            </div>
          </CardContent>
        </div>
      </div>

      {/* Content */}
      <>
          {/* Driver Mode Toggle */}
          {isDriver && (
            <div className="pb-6" onClick={() => !isTogglingRole && handleRoleToggle(!isDriverModeActive)}>
              <Card className={`cursor-pointer transition-all duration-300 ease-in-out hover:border-purple-500/50 ${isDriverModeActive ? 'border-purple-500/50 bg-gradient-to-r from-gray-800 to-purple-900/20' : 'border-gray-700'}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Truck className={`h-6 w-6 transition-colors ${isDriverModeActive ? 'text-purple-400' : 'text-gray-500'}`} />
                      <div>
                        <Label htmlFor="driver-mode-switch" className="font-semibold text-white text-base cursor-pointer">Driver Mode</Label>
                        <p className="text-sm text-gray-400">Switch to manage your deliveries</p>
                      </div>
                    </div>
                    {isTogglingRole ? <Loader2 className="h-5 w-5 animate-spin" /> :
                      <div className="pointer-events-none">
                        <Switch id="driver-mode-switch" checked={isDriverModeActive} className="data-[state=checked]:bg-purple-600 data-[state=unchecked]:bg-gray-600" />
                      </div>
                    }
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          {/* Stats */}
          <div className="pb-6">
            <div className={`grid ${hasStore ? 'grid-cols-3' : 'grid-cols-2'} gap-3`}>
              <Card>
                <CardContent className="p-2 sm:p-4 text-center space-y-1 flex flex-col items-center justify-center h-full">
                  <div className="text-xl sm:text-2xl font-bold text-purple-400">{orderStats?.totalOrders ?? 0}</div>
                  <div className="text-xs text-gray-400">Orders</div>
                </CardContent>
              </Card>
              {hasStore && (
                <Card>
                  <CardContent className="p-2 sm:p-4 text-center space-y-1 flex flex-col items-center justify-center h-full">
                    {avgRating === undefined ? <Loader2 className="h-6 w-6 animate-spin" /> : (
                      <>
                        <div className="text-xl sm:text-2xl font-bold text-purple-400 flex items-center justify-center gap-1"><Star size={16} className="text-yellow-400" />{avgRating > 0 ? avgRating.toFixed(1) : '-'}</div>
                        <div className="text-xs text-gray-400">Avg Rating</div>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardContent className="p-2 sm:p-4 text-center space-y-1 flex flex-col items-center justify-center h-full">
                  <div className="text-lg sm:text-xl font-bold text-purple-400">π{orderStats?.totalSpent.toFixed(2) ?? '0'}</div>
                  <div className="text-xs text-gray-400">Total Spent</div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Menu Items */}
          <div className="space-y-2">
            {menuItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <Card key={index} className="transition-transform duration-200 hover:scale-105">
                  <CardContent className="p-0">
                    <Button
                      onClick={item.action}
                      className="w-full p-4 h-auto justify-between items-center flex text-left"
                    >
                      <div className="flex items-center">
                        <Icon className="h-5 w-5 text-purple-400 mr-4 flex-shrink-0" />
                        <div className="font-medium text-white">{item.title}</div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-500" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Logout Button */}
          <div className="pt-4">
            <Card className="transition-transform duration-200 hover:scale-105">
              <CardContent className="p-0">
                <SignOutButton onLogout={onLogout}>
                  <div className="w-full p-4 h-auto justify-start items-center flex text-left">
                    <div className="flex items-center">
                      <LogOut className="h-5 w-5 text-red-400 mr-4 flex-shrink-0" />
                      <div className="font-medium text-red-400">Sign Out</div>
                    </div>
                  </div>
                </SignOutButton>
              </CardContent>
            </Card>
          </div>
      </>
    </div>
  );
}