import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a number as a price string with the Pi symbol, showing up to 7 decimal places.
 * It removes trailing zeros from the decimal part.
 * e.g., 5.2500000 becomes "π5.25", and 5.0000000 becomes "π5".
 * @param price The numeric price to format.
 */
export const formatPiPrice = (price: number): string => {
  if (typeof price !== 'number' || isNaN(price)) return "π0";
  
  // Convert to a string with 7 decimal places to handle small numbers without scientific notation.
  let priceString = price.toFixed(7);
  
  // Remove trailing zeros, but keep at least one zero if the result is '0.'.
  priceString = priceString.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '');

  return `π${priceString}`;
};

/**
 * Formats a wallet address for display, showing the beginning and end.
 * e.g., "GABC...XYZ1"
 * @param address The wallet address string.
 */
export const formatWalletAddress = (address: string | undefined): string => {
  if (!address) return "Not linked";
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
};