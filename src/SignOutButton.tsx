"use client";

export function SignOutButton({ onLogout, children }: { onLogout: () => void; children?: React.ReactNode }) {
  return (
    <button
     className="w-full"
     onClick={onLogout}
   >
     {children ?? (
        <div className="w-full bg-red-500/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl hover:bg-red-500/30 transition-colors font-semibold">
          Sign Out
        </div>
      )}
   </button>
  );
}