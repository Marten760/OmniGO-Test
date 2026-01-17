import { useQuery, useMutation} from "convex/react";
import { api } from "../../convex/_generated/api";
import { ProductItemsList } from "./ProductItemsList";
import { ReviewsList } from "./ReviewsList";
import { PopularItems } from "./PopularItems";
import { AddReview } from "./AddReview";
import { ProductItemDetailModal } from "./ProductItemDetailModal";
import { ShareButton } from "./ShareButton";
import { toast } from "sonner";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Doc, Id } from "../../convex/_generated/dataModel";import { ArrowLeft, Clock, Loader2, MapPin, Phone, Star, Tag, Truck, StarHalf, AlignJustify, Image as ImageIcon, Info, X, ExternalLink, ChevronLeft, ChevronRight, Heart, Bell, BellOff, Briefcase, MessageSquare } from "lucide-react";
import { formatPiPrice } from "../lib/utils";

interface StoreDetailProps {
  storeId: Id<"stores">;
  onBack: () => void;
  onNavigateToChat: (conversationId: Id<"conversations">) => void;
}

function StoreDetailSkeleton() {
  return (
    <div>
      {/* Header Skeleton */}
      <div className="h-56 md:h-72 bg-gray-800 relative skeleton-shimmer">
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/50 to-transparent" />
        <div className="absolute top-6 left-4 sm:left-6 lg:left-8 bg-gray-700/50 h-12 w-12 rounded-full"></div>
      </div>

      {/* Info Card Skeleton */}
      <div className="px-4 sm:px-6 lg:px-8 py-8 -mt-24 relative z-10">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-2xl relative">
            <div className="absolute -top-16 left-6 w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-gray-700 border-4 border-gray-800 skeleton-shimmer">
            </div>
            <div className="pt-12 md:pt-0 md:pl-40">
            <div className="h-8 skeleton-shimmer rounded w-3/4 mb-3"></div>
            <div className="flex items-center space-x-4 mb-5">
              <div className="h-5 skeleton-shimmer rounded w-1/4"></div>
              <div className="h-5 skeleton-shimmer rounded w-1/4"></div>
            </div>
            <div className="space-y-2 mb-6">
              <div className="h-4 skeleton-shimmer rounded w-full"></div>
              <div className="h-4 skeleton-shimmer rounded w-5/6"></div>
            </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 border-t border-b border-gray-700 py-4">
              <div className="h-5 skeleton-shimmer rounded w-full"></div>
              <div className="h-5 skeleton-shimmer rounded w-full"></div>
            </div>
            <div className="flex flex-wrap gap-2 mb-6">
              <div className="h-6 w-20 skeleton-shimmer rounded-full"></div>
              <div className="h-6 w-24 skeleton-shimmer rounded-full"></div>
            </div>
            <div className="flex space-x-1 bg-gray-800 rounded-xl p-1">
              <div className="flex-1 py-5 rounded-lg skeleton-shimmer"></div>
              <div className="flex-1 py-5 rounded-lg skeleton-shimmer"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface MenuCategoriesNavProps {
  products: Record<string, Doc<"products">[]>;
  activeCategory: string;
  onCategorySelect: (category: string) => void;
}

function MenuCategoriesNav({ products, activeCategory, onCategorySelect }: MenuCategoriesNavProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const categories = Object.keys(products);

  const scrollToCategory = (category: string) => {
    const categoryId = `category-${category.replace(/\s+/g, '-')}`;
    const element = document.getElementById(categoryId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    onCategorySelect(category); // Let parent handle state
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef]);

  return (
    <div className="sticky top-0 z-20 bg-gray-900/80 backdrop-blur-md py-3 mb-8 border-b border-gray-700">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center space-x-3">
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(prev => !prev)}
              className="p-2.5 rounded-full whitespace-nowrap transition-all duration-200 text-sm font-medium bg-gray-800 text-gray-300 hover:bg-purple-600 hover:text-white"
              aria-label="View all categories"
            >
              <AlignJustify size={18} />
            </button>
            {isDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl p-2 z-10 animate-fade-in-sm">
                <div className="max-h-80 overflow-y-auto scrollbar-hide">
                  {Object.entries(products).map(([category, items]) => (
                    <button key={category} onClick={() => scrollToCategory(category)} className={`w-full text-left flex justify-between items-center px-3 py-2 rounded-lg transition-colors ${
                      activeCategory === category ? 'bg-purple-600/30' : 'hover:bg-purple-600/20'
                    }`}>
                      <span className="font-medium text-white">{category}</span>
                      <span className="text-xs text-gray-400 bg-gray-700 px-2 py-0.5 rounded-full">{items.length}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex space-x-3 overflow-x-auto pb-2 -mb-2 flex-grow scrollbar-hide">
            {categories.map(category => (
              <button key={category} onClick={() => scrollToCategory(category)} className={`px-4 py-2 rounded-full whitespace-nowrap transition-all duration-200 text-sm font-medium ${
                activeCategory === category ? 'bg-purple-600 text-white shadow-lg' : 'bg-gray-800 text-gray-300 hover:bg-purple-500 hover:text-white'
              }`}>
                {category}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function StoreDetail({ storeId, onBack, onNavigateToChat }: StoreDetailProps) {
  const [activeTab, setActiveTab] = useState<"menu" | "reviews">("menu");
  const [selectedProductItem, setSelectedProductItem] = useState<(Doc<"products"> & { imageUrls: (string | null)[] }) | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const sessionToken = useMemo(() => localStorage.getItem("sessionToken"), []);
  const isFollowingQuery = useQuery(
    api.follows.isFollowing,
    sessionToken ? { tokenIdentifier: sessionToken, storeId: storeId } : "skip"
  );
  const toggleFollowMutation = useMutation(api.follows.toggleFollow);
  const isFavoritedQuery = useQuery(
    api.storeFavorites.isFavorite,
    sessionToken ? { tokenIdentifier: sessionToken, storeId: storeId } : "skip"
  );
  const toggleFavoriteMutation = useMutation(api.storeFavorites.toggleFavorite);
  const applyToBeDriver = useMutation(api.drivers.applyToBeDriver);
  const findOrCreateConversation = useMutation(api.chat.findOrCreateConversation);
  const [isTogglingFollow, setIsTogglingFollow] = useState(false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);

  const handleToggleFollow = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!sessionToken) return toast.error("Please sign in to follow stores.");
    setIsTogglingFollow(true);
    toggleFollowMutation({ storeId, tokenIdentifier: sessionToken }).finally(() => {
      setIsTogglingFollow(false);
    });
  }, [sessionToken, storeId, toggleFollowMutation]);

  const handleToggleFavorite = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!sessionToken) return toast.error("Please sign in to like stores.");
    setIsTogglingFavorite(true);
    toggleFavoriteMutation({ storeId, tokenIdentifier: sessionToken }).finally(() => {
      setIsTogglingFavorite(false);
    });
  }, [sessionToken, storeId, toggleFavoriteMutation]);

  const handleApplyForJob = async () => {
    if (!sessionToken) return toast.error("Please sign in to apply.");
    setIsApplying(true);
    try {
      await applyToBeDriver({ storeId, tokenIdentifier: sessionToken });
      toast.success("Application Sent!", {
        description: "The store owner has been notified. You will be contacted if approved.",
      });
    } catch (error: any) {
      const errorMessage = error.data?.message || error.message || "An unknown error occurred.";
      if (errorMessage.includes("You have already applied")) {
        const statusMatch = errorMessage.match(/Status: (\w+)/);
        const status = statusMatch ? statusMatch[1] : 'unknown';
        let description = `You have already applied to this store. Your application status is: ${status}.`;
        if (status === 'pending') {
          description = "Your application is currently pending review by the store owner.";
        } else if (status === 'active') {
          description = "You are already an active driver for this store.";
        }
        toast.info("Application Status", { description });
      } else {
        toast.error("Application Failed", { description: errorMessage });
      }
    } finally {
      setIsApplying(false);
    }
  };

  const handleContactStore = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!store) return toast.error("Store details not available.");
    if (!sessionToken) return toast.error("Please sign in to contact the store.");
    setIsCreatingChat(true);
    try {
      const conversationId = await findOrCreateConversation({ storeId: store._id, tokenIdentifier: sessionToken });
      // The user requested to disable direct navigation to chat.
      // onNavigateToChat(conversationId); 
      toast.success("Conversation started!", { description: "You can find it in your chats list." });
    } catch (error: any) {
      toast.error("Failed to start conversation", { description: error.data?.message || error.message });
    } finally {
      setIsCreatingChat(false);
    }
  };

  // 1. Fetch primary store data.
  const storeData = useQuery(api.stores.getStoreById, { storeId: storeId });
  const store = useMemo(() => {
    if (!storeData) return storeData;
    // Ensure galleryImageUrls is always an array
    return { ...storeData, galleryImageUrls: storeData.galleryImageUrls || [] };
  }, [storeData]);
  
  // 2. Fetch products.
  const products = useQuery(api.products.getProductsByStore, { storeId: storeId });

  // 3. Lazily fetch reviews only when the "reviews" tab is active.
  const reviews = useQuery(
    api.reviews.getStoreReviews,
    activeTab === "reviews" ? { storeId: storeId, limit: 10 } : "skip"
  );

  // Reset gallery index when modal opens
  useEffect(() => {
    if (isInfoModalOpen) {
      setGalleryIndex(0);
    }
  }, [isInfoModalOpen]);

  const handleGalleryScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, clientWidth } = scrollContainerRef.current;
      const newIndex = Math.round(scrollLeft / clientWidth);
      setGalleryIndex(newIndex);
    }
  };

  // Effect to track which category is currently visible on scroll
  useEffect(() => {
    if (!products || activeTab !== 'menu') return;

    const categories = Object.keys(products);
    if (categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0]);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        // Filter only intersecting entries
        const intersectingEntries = entries.filter(entry => entry.isIntersecting);

        // Find the entry that is most visible at the top of the viewport
        const topEntry = intersectingEntries.reduce((closest, entry) => {
          // If closest is null, or if the current entry is higher up the page
          if (!closest || entry.boundingClientRect.top < closest.boundingClientRect.top) {
            return entry;
          }
          return closest;
        }, null as IntersectionObserverEntry | null);
        
        if (topEntry) {
          const categoryName = topEntry.target.id.replace('category-', '').replace(/-/g, ' ');
          setActiveCategory(categoryName);
        }
      },
      {
        // The top margin compensates for the sticky header height.
        // The bottom margin creates a narrow horizontal "tripwire" at the top of the viewport.
        // This ensures activation is precise and top-aligned.
        rootMargin: "-100px 0px -80% 0px",
        threshold: 0.1, // Trigger when at least 10% of the title is visible in the tripwire area.
      }
    );

    const elements = categories
      .map(category => document.getElementById(`category-${category.replace(/\s+/g, '-')}`))
      .filter(Boolean);
      
    elements.forEach(el => observer.observe(el!));
    return () => elements.forEach(el => observer.unobserve(el!));
  }, [products, activeTab]); // Rerun when products load or tab changes

  if (store === undefined) {
    return <StoreDetailSkeleton />;
  }

  if (store === null) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-white">
        <div className="text-center">
          <div className="text-6xl mb-4">🤷</div>
          <h3 className="text-xl font-semibold mb-2">Store Not Found</h3>
          <p className="text-gray-400">This store doesn't exist or has been removed.</p>
          <button
            onClick={onBack}
            className="mt-6 bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors font-semibold"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating - fullStars >= 0.5;

    // Full stars
    for (let i = 0; i < fullStars; i++) {
      stars.push(<Star key={`full-${i}`} size={16} className="text-yellow-400 fill-yellow-400" />);
    }

    // Half star
    if (hasHalfStar) {
      stars.push(<StarHalf key="half" size={16} className="text-yellow-400 fill-yellow-400" />);
    }

    // Empty stars
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(<Star key={`empty-${i}`} size={16} className="text-gray-400" />);
    }
    return stars;
  };

  const getStoreStatus = () => {
    // Case 1: Manually closed by the owner.
    if (!store.isOpen) {
      return { text: "Temporarily Closed", color: "text-red-400" };
    }

    const now = new Date();
    const todayStr = now.toLocaleDateString('en-US', { weekday: 'long' });
    const todaysHours = store.openingHours.find(h => h.day === todayStr);

    // Case 2: Not scheduled to be open today.
    if (!todaysHours || !todaysHours.isOpen) {
      return { text: "Closed Today", color: "text-red-400" };
    }

    // Case 3: Scheduled to be open, check current time.
    const [openHour, openMinute] = todaysHours.open.split(':').map(Number);
    const [closeHour, closeMinute] = todaysHours.close.split(':').map(Number);

    const openTime = new Date();
    openTime.setHours(openHour, openMinute, 0, 0);

    const closeTime = new Date();
    closeTime.setHours(closeHour, closeMinute, 0, 0);

    // Handle overnight hours (e.g., closes at 02:00)
    if (closeTime < openTime && now < openTime) {
      // If it's early morning before open time, the open time was yesterday
      openTime.setDate(openTime.getDate() - 1);
    } else if (closeTime < openTime) {
      // If it's evening after open time, the close time is tomorrow
      closeTime.setDate(closeTime.getDate() + 1);
    }

    if (now >= openTime && now <= closeTime) {
      return { text: `Open until ${todaysHours.close}`, color: "text-green-400" };
    } else if (now < openTime) {
      return { text: `Opens at ${todaysHours.open}`, color: "text-yellow-400" };
    } else {
      return { text: "Closed", color: "text-red-400" };
    }
  };

  const storeStatus = getStoreStatus();

  return (
    <div className="animate-fade-in">
      {/* --- Header with Gallery Image --- */}
      <div className="relative">
        <div className="h-56 md:h-72 relative">
          {store.galleryImageUrls && store.galleryImageUrls.length > 0 ? (
            <img src={store.galleryImageUrls[0] ?? undefined} alt={`${store.name} gallery`} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
              <ImageIcon size={64} className="text-gray-600" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/60 to-transparent" />
        </div>
        <button onClick={onBack} className="absolute top-4 left-4 sm:top-6 sm:left-6 lg:left-8 bg-black/50 backdrop-blur-sm text-white p-2 sm:p-3 rounded-full hover:bg-black/70 transition-all duration-200 hover:scale-105 active:scale-100 z-10">
          <ArrowLeft size={20} />
        </button>
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6 lg:right-8 z-10 flex items-center gap-2">
          <button
            onClick={handleContactStore}
            disabled={isCreatingChat}
            className="bg-black/50 backdrop-blur-sm text-white p-2 sm:p-3 rounded-full hover:bg-black/70 transition-all duration-200 hover:scale-105 active:scale-100"
            aria-label="Contact store"
          >
            {isCreatingChat ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <MessageSquare size={20} />
            )}
          </button>
          <button
            onClick={handleToggleFollow}
            disabled={isTogglingFollow || isFollowingQuery === undefined}            className="bg-black/50 backdrop-blur-sm text-white p-2 sm:p-3 rounded-full hover:bg-black/70 transition-all duration-200 hover:scale-105 active:scale-100"
            aria-label={isFollowingQuery ? "Unfollow store" : "Follow store"}
          >
            {isTogglingFollow ? (
              <Loader2 size={20} className="animate-spin" />
            ) : isFollowingQuery ? (
              <BellOff size={20} className="text-red-400" />
            ) : (
              <Bell size={20} />
            )}
          </button>
          <button
            onClick={handleToggleFavorite}
            disabled={isTogglingFavorite || isFavoritedQuery === undefined}
            className="bg-black/50 backdrop-blur-sm text-white p-2 sm:p-3 rounded-full hover:bg-black/70 transition-all duration-200 hover:scale-105 active:scale-100"
            aria-label={isFavoritedQuery ? "Unlike store" : "Like store"}
          >
            {isTogglingFavorite ? (
              <Loader2 size={20} className="animate-spin" />
            ) : isFavoritedQuery ? (
              <Heart size={20} className="text-red-500 fill-red-500" />
            ) : (
              <Heart size={20} className="text-white/80" />
            )}
          </button>
          <ShareButton storeName={store.name} className="bg-black/50 backdrop-blur-sm text-white p-2 sm:p-3 rounded-full hover:bg-black/70 transition-all duration-200 hover:scale-105 active:scale-100" />
        </div>
      </div>

      {/* --- Store Info Card --- */}
      <div className="px-4 sm:px-6 lg:px-8 -mt-20 md:-mt-24 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="bg-gray-800 rounded-2xl p-4 sm:p-6 border border-gray-700 shadow-2xl relative">
            {/* Logo */}
            <div className="absolute -top-10 sm:-top-12 left-4 sm:left-6 w-20 h-20 sm:w-24 md:w-32 sm:h-24 md:h-32 rounded-2xl bg-gray-700 border-4 border-gray-800 overflow-hidden flex items-center justify-center">
              {store.imageUrl ? (
                <img src={store.imageUrl ?? undefined} alt={`${store.name} logo`} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <span className="text-5xl">🏪</span>
              )}
            </div>

            {/* Details */}
            <div className="pt-14 md:pt-0 md:pl-36 lg:pl-40">
              <div className="flex items-center space-x-3 mb-2">
                <h1 className="text-2xl sm:text-3xl font-bold text-white">{store.name}</h1>
                {store.hasOffer && <span className="bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 animate-pulse"><Tag size={12} /> OFFER</span>}
              </div>
              <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-gray-400 mb-4 text-sm sm:text-base">
                <div className="flex items-center space-x-1">
                  <div className="flex items-center">{renderStars(store.rating)}</div>
                  <span className="font-semibold text-white ml-1">{store.rating.toFixed(1)}</span>
                  <span className="hidden sm:inline">({store.totalReviews} reviews)</span>
                </div>
                {store.categories.length > 0 && <span className="hidden sm:block text-gray-600">•</span>}
                <span className="text-gray-300">{store.categories.join(', ')}</span>
                <span className="hidden sm:block text-gray-600">•</span>
                <span className="text-gray-300">{Array.isArray(store.priceRange) ? store.priceRange.join(' • ') : store.priceRange}</span>
              </div>
              <p className="text-gray-300 mb-4 text-sm">{store.description}</p>
              {store.hasOffer && store.offerText && <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-3 mb-4"><p className="text-red-300 font-medium text-sm">{store.offerText}</p></div>}
            </div>

            {/* --- Additional Info Section --- */}
            <div className="border-t border-gray-700 mt-6 pt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-gray-400">
              <div className="flex items-start space-x-3">
                <Clock size={18} className="text-purple-400 flex-shrink-0 mt-0.5" />
                <div className={`text-sm font-semibold ${storeStatus.color}`}>
                  <span>
                    {storeStatus.text}
                  </span>
                </div>
              </div>
              <div className="flex items-start space-x-3"><MapPin size={18} className="text-purple-400 flex-shrink-0 mt-0.5" /><span className="text-sm">{store.address}</span></div>
              {store.phone && <div className="flex items-start space-x-3"><Phone size={18} className="text-purple-400 flex-shrink-0 mt-0.5" /><span className="text-sm">{store.phone}</span></div>}
              {store.hasDelivery && <div className="flex items-start space-x-3 text-green-400"><Truck size={18} className="flex-shrink-0 mt-0.5" /><span className="text-sm">Delivery Available</span></div>}
              {store.dietaryOptions.length > 0 && (
                <div className="flex items-start space-x-3 lg:col-span-2">
                  <Info size={18} className="text-purple-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <span className="font-semibold text-gray-200">Dietary Options</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {store.dietaryOptions.map((option) => <span key={option} className="bg-green-600/20 text-green-400 px-2 py-0.5 rounded-md text-xs font-medium border border-green-600/30 capitalize">{option}</span>)}
                    </div>
                  </div>
                </div>
              )}
              {/* More Info Button */}
              <button 
                onClick={() => setIsInfoModalOpen(true)}
                className="flex items-start space-x-3 text-purple-400 hover:text-purple-300 transition-colors w-full text-left">
                <Info size={18} className="flex-shrink-0 mt-0.5" />
                <span className="text-sm font-semibold">More Store Info</span>
              </button>
            </div>
            
            {/* Apply for Job Button */}
            {store.isRecruitingDrivers && (
              <div className="sm:col-span-2 lg:col-span-3 mt-4">
                <button onClick={handleApplyForJob} disabled={isApplying} className="w-full flex items-center justify-center gap-2 bg-gray-700/50 hover:bg-gray-700 text-gray-300 hover:text-white font-semibold py-3 rounded-xl transition-all duration-200 disabled:opacity-50">
                  {isApplying ? <Loader2 className="h-5 w-5 animate-spin" /> : <Briefcase className="h-5 w-5" />}
                  {isApplying ? "Submitting Application..." : "Work with us as a driver"}
                </button>
              </div>
            )}

            {/* --- Tabs --- */}
            <div className="flex space-x-1 bg-gray-700 rounded-xl p-1 mt-6">
              <button onClick={() => setActiveTab("menu")} className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-200 ${activeTab === "menu" ? "bg-purple-600 text-white shadow-lg font-semibold" : "text-gray-400 hover:text-white hover:bg-gray-700"}`}>Menu</button>
              <button onClick={() => setActiveTab("reviews")} className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-200 ${activeTab === "reviews" ? "bg-purple-600 text-white shadow-lg font-semibold" : "text-gray-400 hover:text-white hover:bg-gray-700"}`}>Reviews ({store.totalReviews})</button>
            </div>
          </div>

          {/* --- Main Content (Menu/Reviews) --- */}
          <div className="mt-8 relative">
            {activeTab === "menu" && (
              <>
                {products === undefined ? (
                  <div className="flex justify-center items-center py-20">
                    <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                  </div>
                ) : (
                  <>
                    <MenuCategoriesNav 
                      products={products} 
                      activeCategory={activeCategory}
                      onCategorySelect={(category) => setActiveCategory(category)}
                    />
                    <ProductItemsList products={products} store={store} onProductItemSelect={setSelectedProductItem} />
                  </>
                )}
              </>
            )}
            {activeTab === "reviews" && (
              <div className="space-y-8">
                <AddReview storeId={storeId} />
                {reviews === undefined ? <div className="flex justify-center items-center py-20"><Loader2 className="w-8 h-8 text-purple-400 animate-spin" /></div> : <ReviewsList reviews={reviews} />}
              </div>
            )}
          </div>

          {/* Footer with Privacy/Terms links */}
          {(store.privacyPolicyUrl || store.termsOfServiceUrl) && (
            <div className="mt-8 text-center text-xs text-gray-500">
              {store.privacyPolicyUrl && (
                <a href={store.privacyPolicyUrl} target="_blank" rel="noopener noreferrer" className="hover:text-gray-400 underline transition-colors">Privacy Policy</a>
              )}
              {store.privacyPolicyUrl && store.termsOfServiceUrl && <span className="mx-2">•</span>}
              {store.termsOfServiceUrl && (
                <a href={store.termsOfServiceUrl} target="_blank" rel="noopener noreferrer" className="hover:text-gray-400 underline transition-colors">Terms of Service</a>
              )}
            </div>
          )}

        </div>
      </div>

      {selectedProductItem && (
        <ProductItemDetailModal
          isOpen={!!selectedProductItem} // Use the correct state variable
          onClose={() => setSelectedProductItem(null)} // Use the correct setter
          item={{ ...selectedProductItem!, storeName: store.name, storeId: store._id }} // Use the correct state variable
          onStoreSelect={() => setIsInfoModalOpen(false)} // Add this prop to satisfy the component's requirements. It does nothing as the user is already on the store page.
        />
      )}

      {/* Zoomed Image Modal */}
      {zoomedImageUrl && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] animate-fade-in flex items-center justify-center p-4" onClick={() => setZoomedImageUrl(null)}>
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <img 
              src={zoomedImageUrl} 
              alt="Zoomed store gallery" 
              className="max-w-full max-h-full object-contain rounded-lg"
            />
            <button onClick={() => setZoomedImageUrl(null)} className="absolute top-2 right-2 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors">
              <X size={24} />
            </button>
          </div>
        </div>
      )}

      {isInfoModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4">
          <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Store Information</h2>
              <button onClick={() => setIsInfoModalOpen(false)} className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto space-y-6 pr-2 scrollbar-hide">
              {/* Store Gallery */}
              {store.galleryImageUrls && store.galleryImageUrls.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-purple-400 mb-3">Store Gallery</h3>
                  <div className="relative">
                    <div
                      ref={scrollContainerRef}
                      onScroll={handleGalleryScroll}
                      className="flex overflow-x-auto snap-x snap-mandatory snap-stop-always scrollbar-hide rounded-lg bg-gray-700"
                    >
                      {store.galleryImageUrls.map((url, index) => (
                        url && <img 
                          key={index}
                          src={url}
                          alt={`Store gallery image ${index + 1}`}
                          loading="lazy"
                          className="w-full h-full object-contain rounded-lg snap-center flex-shrink-0 cursor-pointer"
                          onClick={() => setZoomedImageUrl(url)}
                        />
                      ))}
                    </div>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                      {store.galleryImageUrls.map((_, index) => (
                        <div key={index} className={`w-2 h-2 rounded-full transition-all duration-300 ${index === galleryIndex ? 'bg-white scale-125' : 'bg-white/50'}`} />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Opening Hours */}
              <div>
                <h3 className="text-lg font-semibold text-purple-400 mb-3">Opening Hours</h3>
                <div className="space-y-2 text-sm">
                  {store.openingHours.map(h => (
                    <div key={h.day} className={`flex justify-between items-center p-2 rounded-lg ${new Date().toLocaleDateString('en-US', { weekday: 'long' }) === h.day ? 'bg-gray-700/50' : ''}`}>
                      <span className="font-medium text-gray-200">{h.day}</span>
                      {h.isOpen ? (
                        <span className="font-mono text-green-400">{h.open} - {h.close}</span>
                      ) : (
                        <span className="font-semibold text-red-400">Closed</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Contact & Location */}
              <div>
                <h3 className="text-lg font-semibold text-purple-400 mb-3">Contact & Location</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start space-x-3"><MapPin size={16} className="text-gray-400 mt-0.5" /><span className="text-gray-300">{store.address}, {store.region}, {store.country}</span></div>
                  {store.phone && <div className="flex items-start space-x-3"><Phone size={16} className="text-gray-400 mt-0.5" /><span className="text-gray-300">{store.phone}</span></div>}
                  {store.email && <div className="flex items-start space-x-3"><Info size={16} className="text-gray-400 mt-0.5" /><span className="text-gray-300">{store.email}</span></div>}
                </div>
              </div>

              {/* Legal Links */}
              {(store.privacyPolicyUrl || store.termsOfServiceUrl) && (
                <div>
                  <h3 className="text-lg font-semibold text-purple-400 mb-3">Legal</h3>
                  <div className="space-y-2 text-sm">
                    {store.privacyPolicyUrl && (
                      <a href={store.privacyPolicyUrl} target="_blank" rel="noopener noreferrer" className="flex items-center space-x-2 text-gray-300 hover:text-purple-400 transition-colors">
                        <span>Privacy Policy</span>
                        <ExternalLink size={14} />
                      </a>
                    )}
                    {store.termsOfServiceUrl && (
                      <a href={store.termsOfServiceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center space-x-2 text-gray-300 hover:text-purple-400 transition-colors">
                        <span>Terms of Service</span>
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
