import { toast } from "sonner";
import { ArrowLeft, Palette, Globe, Bell, LogOut, Sun, Moon, Laptop } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { SignOutButton } from "@/SignOutButton";
import { useTheme } from "@/context/ThemeProvider";
import { cn } from "@/lib/utils";

export function SettingsView({ onBack, onLogout }: { onBack: () => void, onLogout: () => void }) {
    const { theme, setTheme } = useTheme();
    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div className="flex items-center space-x-4 mb-6">
                <button onClick={onBack} className="p-2 hover:bg-gray-700 rounded-full transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <h3 className="text-xl font-bold text-white">Settings</h3>
            </div>

            <div className="space-y-8">
                {/* App Preferences Section */}
                <div>
                    <h4 className="text-sm font-semibold text-gray-400 mb-3 px-1">Preferences</h4>
                    <div className="bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden">
                        <div className="divide-y divide-gray-700">
                            {/* Language Setting */}
                            <div className="flex items-center justify-between p-4">
                                <div className="flex items-center gap-4">
                                    <Globe className="h-5 w-5 text-purple-400" />
                                    <div>
                                        <h5 className="font-medium text-white">Language</h5>
                                        <p className="text-sm text-gray-400">Select your preferred language.</p>
                                    </div>
                                </div>
                                <button onClick={() => toast.info("Language settings coming soon!")} className="text-sm text-gray-300 bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg transition-colors">
                                    English
                                </button>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}