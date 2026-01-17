import React, { useState, useMemo } from 'react';
import { useCart } from '../context/CartContext';
import { Button } from './ui/button';
import { PiPayment } from './PiPayment';
import { toast } from 'sonner';
import { Id } from '../../convex/_generated/dataModel';
import { DiscountCodeInput } from './DiscountCodeInput';
import { useQuery } from 'convex/react';
import { PaymentMetadata } from '../types';
import { api } from '../../convex/_generated/api';
import { XCircle } from 'lucide-react';

interface CheckoutSummaryProps {
  storeId: Id<'stores'>;
  deliveryFee: number;
}

type AppliedDiscount = {
  code: string;
  details: {
    id: Id<'discounts'>;
    type: 'percentage' | 'fixed';
    value: number;
  };
};

const formatPrice = (price: number): string => `π${parseFloat(price.toFixed(7))}`;

export const CheckoutSummary: React.FC<CheckoutSummaryProps> = ({ storeId, deliveryFee }) => {
  const { items, getTotalPrice, clearCart } = useCart();
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);
  const [isLoadingDiscount, setIsLoadingDiscount] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState<AppliedDiscount | null>(null);

  const subtotal = getTotalPrice();

  const validationResult = useQuery(
    api.marketing.validateDiscountCode,
    submittedCode ? { storeId: storeId, code: submittedCode, orderTotal: subtotal } : 'skip'
  );  

  React.useEffect(() => {
    if (submittedCode && validationResult) {
      setIsLoadingDiscount(false);
      if (validationResult.isValid) {
        toast.success(validationResult.message);
        setAppliedDiscount({ code: submittedCode.toUpperCase(), details: validationResult.discount! });
      } else {
        toast.error(validationResult.message || 'Invalid discount code');
      }
      setSubmittedCode(null);
    } 
  }, [validationResult, submittedCode]);

  const discountAmount = useMemo(() => {
    if (!appliedDiscount) return 0;
    const { type, value } = appliedDiscount.details;
    return type === 'fixed' ? Math.min(value, subtotal) : (subtotal * value) / 100;
  }, [appliedDiscount, subtotal]);

  const total = subtotal - discountAmount + deliveryFee;

  const handlePaymentSuccess = (paymentId: string, txid: string) => {
    toast.success('Order placed successfully!');
    clearCart();
  };

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6 space-y-4">
      <h3 className="text-xl font-bold text-white">Order Summary</h3>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between text-gray-300"><span>Subtotal</span><span>{formatPrice(subtotal)}</span></div>
        {appliedDiscount && (
          <div className="flex justify-between items-center text-green-400">
            <div className="flex items-center gap-2">
              <span>Discount ({appliedDiscount.code})</span>
              <button onClick={() => setAppliedDiscount(null)} title="Remove discount">
                <XCircle className="h-4 w-4 text-red-500 hover:text-red-400" />
              </button>
            </div>
            <span>-{formatPrice(discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between text-gray-300"><span>Delivery Fee</span><span>{formatPrice(deliveryFee)}</span></div>
        <div className="flex justify-between text-white font-bold text-lg pt-2 border-t border-gray-600"><span>Total</span><span>{formatPrice(total)}</span></div>
      </div>
      <DiscountCodeInput onApply={setSubmittedCode} isLoading={isLoadingDiscount} disabled={!!appliedDiscount} />
      <div>
        <label htmlFor="address" className="block text-sm font-medium text-gray-300 mb-2">Delivery Address</label>
        <input type="text" id="address" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white focus:border-purple-500 focus:ring-purple-500" />
      </div>
      <PiPayment
        amount={total}
        memo={`Order from OmniGo`}
        metadata={{
          storeId: storeId,
          items: items.map(i => ({
            id: i.id.split('-')[0],
            quantity: i.quantity,
            price: i.price,
            options: i.options
          })), 
          deliveryAddress,
          subtotal,
          discount: appliedDiscount ? { code: appliedDiscount.code, amount: discountAmount } : undefined,
          deliveryFee,
          total
        } as PaymentMetadata}
        onPaymentSuccess={handlePaymentSuccess}
        disabled={!deliveryAddress.trim() || items.length === 0}
      >
        <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 font-bold text-white hover:from-purple-700 hover:to-pink-700" disabled={!deliveryAddress.trim() || items.length === 0}>
          Pay Now
        </Button>
      </PiPayment>
    </div>
  );
};