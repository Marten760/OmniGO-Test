import { useState, useEffect, useMemo } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Doc, Id } from '../../../convex/_generated/dataModel';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Users, Target, UserCheck, Percent, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '../../hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type DiscountType = 'percentage' | 'fixed';

interface EditDiscountFormProps {
  discount: Doc<"discounts">;
  onBack: () => void;
}

export function EditDiscountForm({ discount, onBack }: EditDiscountFormProps) {
  const [formState, setFormState] = useState({
    code: '',
    type: undefined as DiscountType | undefined,
    value: '',
    startDate: '',
    endDate: '',
    minOrderValue: '',
    usageLimit: '',
    targetUsers: 'all' as 'all' | 'new_users_only',
    limitPerUser: false,
    isActive: true,
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const { sessionToken } = useAuth();
  const updateDiscountMutation = useMutation(api.marketing.updateDiscount);

  useEffect(() => {
    if (discount) {
      setFormState({
        code: discount.code,
        type: discount.type,
        value: String(discount.value),
        startDate: discount.startDate ? new Date(discount.startDate).toISOString().split('T')[0] : '',
        endDate: discount.endDate ? new Date(discount.endDate).toISOString().split('T')[0] : '',
        minOrderValue: String(discount.minOrderValue || ''),
        usageLimit: String(discount.usageLimit || ''),
        targetUsers: discount.targetUsers,
        limitPerUser: !!discount.usageLimitPerUser,
        isActive: discount.isActive,
      });
    }
  }, [discount]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: value }));
  };

  const handleUpdateDiscount = async () => {
    const numericValue = parseFloat(formState.value);
    if (!formState.code || !formState.type || !formState.value || isNaN(numericValue) || numericValue <= 0) {
      toast.error('Invalid Input', { description: 'Please fill all fields with valid values.' });
      return;
    }

    setIsUpdating(true);
    if (!sessionToken) {
      toast.error("Authentication error. Please log in again.");
      setIsUpdating(false);
      return;
    }
    try {
      await updateDiscountMutation({
        tokenIdentifier: sessionToken,
        discountId: discount._id,
        code: formState.code,
        type: formState.type,
        value: numericValue,
        startDate: formState.startDate || undefined,
        endDate: formState.endDate || undefined,
        minOrderValue: formState.minOrderValue ? parseFloat(formState.minOrderValue) : undefined,
        usageLimit: formState.usageLimit ? parseInt(formState.usageLimit, 10) : undefined,
        usageLimitPerUser: formState.limitPerUser ? 1 : undefined,
        targetUsers: formState.targetUsers,
        isActive: formState.isActive,
      });
      toast.success('Success', { description: `Discount "${formState.code}" updated successfully.` });
      onBack();
    } catch (error: any) {
      console.error("Error updating discount:", error);
      toast.error('Error Updating Discount', {
        description: error.data?.message || 'An unexpected error occurred.',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center space-x-4 mb-6">
        <button onClick={onBack} className="p-2 hover:bg-gray-700 rounded-full transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h3 className="text-xl font-bold text-white">Edit Discount: {discount.code}</h3>
      </div>

      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="space-y-2">
          <Label className="font-semibold text-gray-300">Discount Code</Label>
          <Input
            name="code"
            placeholder="E.g., SUMMER20"
            value={formState.code}
            onChange={handleInputChange}
            className="border-gray-700 bg-gray-800/80 text-gray-200 rounded-xl"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Select value={formState.type} onValueChange={(value) => setFormState(prev => ({ ...prev, type: value as DiscountType }))}>
            <SelectTrigger className="border-gray-700 bg-gray-800/80 text-gray-200 rounded-xl">
              <div className="flex items-center gap-2">
                {formState.type === 'percentage' && <Percent className="h-4 w-4 text-gray-400" />}
                {formState.type === 'fixed' && <DollarSign className="h-4 w-4 text-gray-400" />}
                <SelectValue placeholder="Discount Type" />
              </div>
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700 text-gray-200">
              <SelectItem value="percentage"><div className="flex items-center"><Percent className="h-4 w-4 mr-2" /><span>Percentage</span></div></SelectItem>
              <SelectItem value="fixed"><div className="flex items-center"><DollarSign className="h-4 w-4 mr-2" /><span>Fixed Amount</span></div></SelectItem>
            </SelectContent>
          </Select>
          <Input
            name="value"
            className="border-gray-700 bg-gray-800/80 text-gray-200 rounded-xl"
            placeholder="Value"
            type="number"
            value={formState.value}
            onChange={handleInputChange}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startDate" className="font-semibold text-gray-300">Start date</Label>
            <Input id="startDate" name="startDate" type="date" value={formState.startDate} onChange={handleInputChange} className="border-gray-700 bg-gray-800/80 text-gray-200 rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate" className="font-semibold text-gray-300">Expiration Date</Label>
            <Input id="endDate" name="endDate" type="date" value={formState.endDate} onChange={handleInputChange} className="border-gray-700 bg-gray-800/80 text-gray-200 rounded-xl" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="minOrderValue" className="font-semibold text-gray-300">Minimum Order (π)</Label>
            <Input id="minOrderValue" name="minOrderValue" type="number" placeholder="e.g., 100" value={formState.minOrderValue} onChange={handleInputChange} className="border-gray-700 bg-gray-800/80 text-gray-200 rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="usageLimit" className="font-semibold text-gray-300">Usage Limit (Total)</Label>
            <Input id="usageLimit" name="usageLimit" type="number" placeholder="e.g., 1000" value={formState.usageLimit} onChange={handleInputChange} className="border-gray-700 bg-gray-800/80 text-gray-200 rounded-xl" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="targetUsers" className="font-semibold text-gray-300">Target Customers</Label>
          <Select value={formState.targetUsers} onValueChange={(value: 'all' | 'new_users_only') => setFormState(prev => ({ ...prev, targetUsers: value }))} >
            <SelectTrigger id="targetUsers" className="border-gray-700 bg-gray-800/80 text-gray-200 rounded-xl">
              <div className="flex items-center gap-2">
                {formState.targetUsers === 'all' && <Users className="h-4 w-4 text-gray-400" />}
                {formState.targetUsers === 'new_users_only' && <Target className="h-4 w-4 text-gray-400" />}
                <SelectValue placeholder="Select target users" />
              </div>
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700 text-gray-200">
              <SelectItem value="all"><div className="flex items-center"><Users className="h-4 w-4 mr-2" /><span>All Customers</span></div></SelectItem>
              <SelectItem value="new_users_only"><div className="flex items-center"><Target className="h-4 w-4 mr-2" /><span>New Customers Only</span></div></SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-gray-700/80 p-3 shadow-sm transition-colors hover:bg-gray-800/40">
          <div className="flex items-center gap-3">
            <UserCheck className="h-5 w-5 text-purple-400" />
            <Label htmlFor="limitPerUser" className="cursor-pointer font-semibold text-gray-300">Limit to one use per customer</Label>
          </div>
          <Switch id="limitPerUser" checked={formState.limitPerUser} onCheckedChange={(checked) => setFormState(prev => ({ ...prev, limitPerUser: checked }))} className="data-[state=checked]:bg-purple-600 data-[state=unchecked]:bg-gray-600" />
        </div>
        <div className="flex items-center justify-between rounded-xl border border-gray-700/80 p-3 shadow-sm transition-colors hover:bg-gray-800/40">
          <div className="flex items-center gap-3">
            <Label htmlFor="isActive" className="cursor-pointer font-semibold text-gray-300">Discount is Active</Label>
          </div>
          <Switch id="isActive" checked={formState.isActive} onCheckedChange={(checked) => setFormState(prev => ({ ...prev, isActive: checked }))} className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-600" />
        </div>

        <div className="flex justify-end gap-4 pt-4">
          <Button variant="outline" onClick={onBack} className="rounded-xl">Cancel</Button>
          <Button
            className="bg-gradient-to-r from-purple-600 to-pink-600 font-bold text-white hover:from-purple-700 hover:to-pink-700"
            onClick={handleUpdateDiscount}
            disabled={isUpdating}
          >
            {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}