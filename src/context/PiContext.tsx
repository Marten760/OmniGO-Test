import { createContext, useContext, ReactNode, useEffect } from 'react';
import { usePi as usePiInternal } from '../hooks/usePi';

// The return type of the internal hook
type PiHookType = ReturnType<typeof usePiInternal>;

const PiContext = createContext<PiHookType | undefined>(undefined);

export function PiProvider({ children }: { children: ReactNode }) {
  const pi = usePiInternal(); // The hook is called once here

  useEffect(() => {
    const Pi = (window as any).Pi;
    if (!Pi) return;

    const isSandbox = import.meta.env.VITE_PI_SANDBOX === 'true';

    console.log(`[PiContext] Initializing Pi SDK with sandbox: ${isSandbox}`);

    Pi.init({
      version: '2.0',
      sandbox: isSandbox
    });
  }, []);

  return <PiContext.Provider value={pi}>{children}</PiContext.Provider>;
}

export function usePi() {
  const context = useContext(PiContext);
  if (!context) throw new Error('usePi must be used within a PiProvider');
  return context;
}