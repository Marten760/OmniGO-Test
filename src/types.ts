import { Id } from "../convex/_generated/dataModel";

export interface PaymentMetadata {
  storeId: Id<"stores">;
  items: {
    id: string; // The original product ID
    quantity: number;
    price: number;
    options?: Record<string, any>;
  }[];
  deliveryAddress: string;
  subtotal: number;
  discount?: { code: string; amount: number };
  deliveryFee: number;
  total: number;
  timestamp?: number;
}