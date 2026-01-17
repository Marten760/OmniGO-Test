import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, TicketPercent } from 'lucide-react';

interface DiscountCodeInputProps {
  onApply: (code: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}

export const DiscountCodeInput: React.FC<DiscountCodeInputProps> = ({ onApply, isLoading, disabled }) => {
  const [code, setCode] = useState('');

  const handleApplyClick = () => {
    if (code.trim()) {
      onApply(code.trim().toUpperCase());
    }
  };

  return (
    <div className="flex w-full items-center space-x-2 rtl:space-x-reverse">
      <Input
        type="text"
        placeholder="Enter the discount code"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        disabled={disabled || isLoading}        className="flex-1 bg-gray-800 border-gray-700 placeholder-gray-500 text-left disabled:cursor-not-allowed disabled:opacity-50"
      />
      <Button type="button" onClick={handleApplyClick} disabled={!code.trim() || isLoading || disabled} className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 shrink-0 rounded-lg">
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="px-2">Apply</span>}
      </Button>
    </div>
  );
};
