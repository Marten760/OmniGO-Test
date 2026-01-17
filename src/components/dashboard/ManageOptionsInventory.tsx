import React, { useState, useEffect, useMemo } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Doc, Id } from '../../../convex/_generated/dataModel';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Save, Minus, Plus } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export type ProductWithOptions = Doc<'products'> & {
  options: NonNullable<Doc<'products'>['options']>;
};

interface ManageOptionsInventoryProps {
  product: ProductWithOptions;
  onClose: () => void;
}

export function ManageOptionsInventory({ product, onClose }: ManageOptionsInventoryProps) {
  const [optionQuantities, setOptionQuantities] = useState<Record<string, Record<string, number>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const { sessionToken } = useAuth();
  const updateQuantitiesMutation = useMutation(api.products.updateOptionQuantities);

  useEffect(() => {
    // Initialize state from product prop
    const initialQuantities: Record<string, Record<string, number>> = {};
    product.options.forEach(option => {
      initialQuantities[option.title] = {};
      option.choices.forEach(choice => {
        initialQuantities[option.title][choice.name] = choice.quantity ?? 0;
      });
    });
    setOptionQuantities(initialQuantities);
  }, [product]);

  const handleQuantityChange = (optionTitle: string, choiceName: string, change: number | 'input', value?: string) => {
    setOptionQuantities(prev => {
      const currentQty = prev[optionTitle]?.[choiceName] ?? 0;
      let newQuantity: number;

      if (change === 'input' && value !== undefined) {
        newQuantity = parseInt(value, 10);
        if (isNaN(newQuantity)) newQuantity = 0;
      } else if (typeof change === 'number') {
        newQuantity = Math.max(0, currentQty + change);
      } else {
        newQuantity = currentQty;
      }

      return {
        ...prev,
        [optionTitle]: { ...prev[optionTitle], [choiceName]: newQuantity },
      };
    });
  };

  const handleSave = async () => {
    if (!sessionToken) {
      toast.error("Authentication error.");
      return;
    }
    setIsSaving(true);

    const updates = Object.entries(optionQuantities).flatMap(([optionTitle, choices]) =>
      Object.entries(choices).map(([choiceName, quantity]) => ({
        optionTitle,
        choiceName,
        quantity,
      }))
    );

    try {
      await updateQuantitiesMutation({
        tokenIdentifier: sessionToken,
        productId: product._id,
        updates,
      });
      toast.success(`Inventory for "${product.name}" updated successfully.`);
      onClose();
    } catch (error: any) {
      toast.error("Failed to save changes.", { description: error.data?.message || error.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-800">
      <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-gray-600 my-3" />
      <div className="p-4 pt-0 flex-shrink-0">
        <h3 className="text-lg font-bold text-white mb-1">Manage Stock for: {product.name}</h3>
        <p className="text-sm text-gray-400">Update the quantity for each product variant.</p>
      </div>
      
      <div className="flex-1 overflow-y-auto px-4 space-y-4">
        {product.options.map(option => (
          <div key={option.title}>
            <h4 className="font-semibold text-purple-300 mb-2">{option.title}</h4>
            <div className="space-y-2">
              {option.choices.map(choice => (
                <div key={choice.name} className="flex items-center justify-between bg-gray-900/50 p-3 rounded-lg border border-gray-700/50">
                  <span className="text-gray-200">{choice.name}</span>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-gray-700" onClick={() => handleQuantityChange(option.title, choice.name, -1)}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      type="number"
                      value={optionQuantities[option.title]?.[choice.name] ?? ''}
                      onChange={(e) => handleQuantityChange(option.title, choice.name, 'input', e.target.value)}
                      className="w-16 bg-gray-700 border-gray-600 text-white text-center font-mono"
                      placeholder="Qty"
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-gray-700" onClick={() => handleQuantityChange(option.title, choice.name, 1)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 border-t border-gray-700 bg-gray-800">
        <Button onClick={handleSave} disabled={isSaving} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3">
          {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Save className="h-5 w-5 mr-2" /> Save Changes</>}
        </Button>
      </div>
    </div>
  );
}