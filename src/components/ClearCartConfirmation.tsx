import React from 'react';
import { Button } from './ui/button';
import { ShoppingCart, AlertTriangle } from 'lucide-react';

interface ClearCartConfirmationProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function ClearCartConfirmation({ onConfirm, onCancel }: ClearCartConfirmationProps) {
  return (
    <div className="fixed inset-0 bg-gray-900 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-md text-center bg-gray-800/50 border border-gray-700 rounded-3xl p-8 shadow-2xl">
        <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-yellow-500/30">
          <AlertTriangle size={32} className="text-yellow-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-3">Start a New Cart?</h2>
        <p className="text-gray-400 mb-8">
          Your cart contains items from a different store. You can only order from one store at a time. Do you want to clear your current cart to add this new item?
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Button onClick={onConfirm} className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold py-3 rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all text-base">
            Yes, Clear Cart & Add
          </Button>
          <Button onClick={onCancel} variant="outline" className="flex-1 bg-gray-700 text-gray-300 font-semibold py-3 rounded-xl hover:bg-gray-600 transition-all text-base border-gray-600 hover:border-gray-500">
            No, Go Back
          </Button>
        </div>
      </div>
    </div>
  );
}