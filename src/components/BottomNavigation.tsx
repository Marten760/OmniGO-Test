import { ShoppingBag, User, Home, Store, Truck, MessageSquare } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../hooks/useAuth';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

interface BottomNavigationProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  onResetChat?: () => void;
}

export function BottomNavigation({ currentView, setCurrentView, onResetChat }: BottomNavigationProps) {
  const { user, sessionToken } = useAuth();
  const { getTotalItems } = useCart();

  const conversations = useQuery(
    api.chat.getConversations,
    sessionToken ? { tokenIdentifier: sessionToken } : "skip"
  );

  const hasStore = useQuery(
    api.stores.checkUserHasStore,
    sessionToken ? { tokenIdentifier: sessionToken } : "skip"
  );

  const unreadTotal = conversations?.reduce((sum, conv) => sum + (conv.unreadCount ?? 0), 0) ?? 0;

  const isDriverMode = user?.profile?.activeRole === 'driver';

  const generalNavItems = [
    { icon: Home, label: 'Home', view: 'home' },
    { icon: ShoppingBag, label: 'Orders', view: 'orders' },
    { icon: MessageSquare, label: 'Chats', view: 'chats' },
    { icon: User, label: 'Account', view: 'account' },
  ];

  if (hasStore) {
    generalNavItems.splice(3, 0, { icon: Store, label: 'Dashboard', view: 'dashboard' });
  }

  const driverNavItems = [
    { icon: Truck, label: 'Deliveries', view: 'delivery' },
    { icon: MessageSquare, label: 'Chats', view: 'chats' },
    { icon: User, label: 'Account', view: 'account' },
  ];

  const navItems = isDriverMode ? driverNavItems : generalNavItems;

  const handleNavClick = (view: string) => {
    setCurrentView(view);
    // إضافة: إعادة تعيين المحادثة إذا كان التنقل خارج chats
    if (view !== 'chats' && onResetChat) {
      onResetChat();
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-800/90 backdrop-blur-md border-t border-gray-700 z-30 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.3)] pb-safe">
      <div className="flex items-center justify-center gap-1 py-2 max-w-md mx-auto">
        {navItems.map(({ icon: Icon, label, view }) => (
          <button
            key={view}
            onClick={() => handleNavClick(view)}
            className={`relative flex flex-1 flex-col items-center space-y-1 py-2 rounded-xl transition-all duration-200 ${
              currentView === view 
                ? 'text-purple-400 bg-purple-600/20 scale-105' 
                : 'text-gray-400 hover:text-white hover:scale-110'
            }`}
          >
            <Icon size={20} />
            <span className="text-xs font-medium">{label}</span>
            {view === 'orders' && getTotalItems() > 0 ? (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {getTotalItems()}
              </span>
            ) : view === 'chats' && unreadTotal > 0 ? (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {unreadTotal}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}