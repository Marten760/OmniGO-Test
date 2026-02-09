export const translations = {
  en: {
    // Navigation
    "nav.home": "Home",
    "nav.orders": "Orders",
    "nav.chats": "Chats",
    "nav.account": "Account",
    "nav.dashboard": "Dashboard",
    "nav.deliveries": "Deliveries",

    // Account Menu
    "account.profile": "Profile Information",
    "account.notifications": "Notifications",
    "account.addresses": "Addresses",
    "account.favorites": "Favorites",
    "account.reviews": "Reviews & Ratings",
    "account.history": "Order History",
    "account.store_dashboard": "Store Dashboard",
    "account.privacy": "Privacy Policy",
    "account.terms": "Terms of Service",
    "account.settings": "Settings",
    "account.signout": "Sign Out",
    "account.driver_mode": "Driver Mode",

    // Settings
    "settings.title": "Settings",
    "settings.preferences": "Preferences",
    "settings.language": "Language",
    "settings.select_language": "Select your preferred language",
    "settings.theme": "Theme",
    
    // General
    "loading": "Loading...",
    "save": "Save",
    "cancel": "Cancel",
    "back": "Back",
    "select": "Select",
    "search": "Search",
    "address": "Address",
    "apply": "Apply",
    "remove": "Remove",
    "deliveryFee": "Delivery Fee",
    "total": "Total",
    "payWithPi": "Pay with Pi Wallet",
  },
  ar: {
    // Navigation
    "nav.home": "الرئيسية",
    "nav.orders": "طلباتي",
    "nav.chats": "المحادثات",
    "nav.account": "حسابي",
    "nav.dashboard": "لوحة التحكم",
    "nav.deliveries": "التوصيل",

    // Account Menu
    "account.profile": "المعلومات الشخصية",
    "account.notifications": "الإشعارات",
    "account.addresses": "العناوين",
    "account.favorites": "المفضلة",
    "account.reviews": "التقييمات والمراجعات",
    "account.history": "سجل الطلبات",
    "account.store_dashboard": "لوحة تحكم المتجر",
    "account.privacy": "سياسة الخصوصية",
    "account.terms": "شروط الخدمة",
    "account.settings": "الإعدادات",
    "account.signout": "تسجيل الخروج",
    "account.driver_mode": "وضع السائق",

    // Settings
    "settings.title": "الإعدادات",
    "settings.preferences": "التفضيلات",
    "settings.language": "اللغة",
    "settings.select_language": "اختر لغتك المفضلة",
    "settings.theme": "المظهر",

    // General
    "loading": "جاري التحميل...",
    "save": "حفظ",
    "cancel": "إلغاء",
    "back": "رجوع",
    "select": "اختر",
    "search": "بحث",
    "address": "العنوان",
    "apply": "تطبيق",
    "remove": "إزالة",
    "deliveryFee": "رسوم التوصيل",
    "total": "المجموع",
    "payWithPi": "ادفع باستخدام محفظة Pi",
  }
};

export type Language = 'en' | 'ar';
export type TranslationKey = keyof typeof translations.en;