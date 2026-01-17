import { usePi } from '../context/PiContext';
import { toast } from 'sonner';

interface ShareButtonProps {
  storeName?: string;
  className?: string;
}

export function ShareButton({ storeName, className = "" }: ShareButtonProps) {
  const { shareApp, isInitialized } = usePi();

  const handleShare = () => {
    if (!isInitialized) {
      toast.error('Pi Browser not detected');
      return;
    }

    const title = storeName 
      ? `Check out ${storeName} on OmniGo!`
      : 'Check out OmniGo!';
    
    const text = storeName
      ? `I found this amazing store "${storeName}" on OmniGo. You can pay with Pi coins! 🛍️π`
      : 'Discover amazing stores and pay with Pi coins on OmniGo! 🛍️π';
      
    try {
      shareApp(title, text);
    } catch (error: any) {
      toast.error('Failed to share');
    }
  };

  if (!isInitialized) {
    return null;
  }

  return (
    <button
      onClick={handleShare}
      className={`flex items-center space-x-2 text-blue-violet hover:text-purple-600 transition-colors ${className}`}
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
      </svg>
      <span className="font-medium">Share</span>
    </button>
  );
}
