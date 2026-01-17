import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id, Doc } from '../../../convex/_generated/dataModel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from "@/components/ui/button";
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Package, PackageCheck, PackageX, Search, Plus, Minus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useDebounce } from '../../hooks/useDebounce';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Drawer } from 'vaul';
import { ManageOptionsInventory, ProductWithOptions } from './ManageOptionsInventory';

interface InventoryTabContentProps {
  storeId: Id<'stores'>;
  storeType: Doc<'stores'>['storeType'];
}

export function InventoryTabContent({ storeId, storeType }: InventoryTabContentProps) {
  const sessionToken = useMemo(() => localStorage.getItem("sessionToken"), []);
  const inventoryDetails = useQuery(
    api.inventory.getInventoryDetails,
    sessionToken ? { storeId, tokenIdentifier: sessionToken } : "skip"
  );
  const [localItems, setLocalItems] = useState(inventoryDetails?.items ?? []);
  const updateAvailability = useMutation(api.inventory.updateProductAvailability);
  const setQuantityMutation = useMutation(api.inventory.setProductQuantity);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'available', 'unavailable'
  const [editingOptionsFor, setEditingOptionsFor] = useState<ProductWithOptions | null>(null);
  const [debouncedItem, setDebouncedItem] = useState<{ productId: Id<"products">, quantity: number } | null>(null);
  const debouncedQuantityUpdate = useDebounce(debouncedItem, 500); // 500ms delay

  // Sync local state when remote data changes
  useEffect(() => {
    if (inventoryDetails?.items) {
      setLocalItems(inventoryDetails.items);
    }
  }, [inventoryDetails]);

  // Effect to call the mutation when the debounced value changes
  useEffect(() => {
    if (debouncedQuantityUpdate && sessionToken) {
      setQuantityMutation({ tokenIdentifier: sessionToken, productId: debouncedQuantityUpdate.productId, newQuantity: debouncedQuantityUpdate.quantity })
        .catch(err => toast.error(`Failed to sync quantity: ${err.message}`));
    }
  }, [debouncedQuantityUpdate, sessionToken, setQuantityMutation]);

  const handleAvailabilityChange = async (productId: Id<'products'>, isAvailable: boolean) => {
    if (!sessionToken) {
      toast.error("Authentication error. Please log in again.");
      return;
    }
    const promise = updateAvailability({ productId, isAvailable, tokenIdentifier: sessionToken });
    toast.promise(promise, {
      loading: 'Updating item status...',
      success: 'Item status updated!',
      error: (err) => `Failed to update: ${(err as Error).message || 'Unknown error'}`,
    });
  };

  const filteredItems = useMemo(() => {
    return localItems
      .filter((item) => {
        if (filterStatus === 'available') return item.isAvailable;
        if (filterStatus === 'unavailable') return !item.isAvailable;
        return true;
      })
      .filter((item) =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [localItems, searchTerm, filterStatus]);

  const handleQuantityChange = useCallback((productId: Id<'products'>, change: number) => {
    setLocalItems(currentItems =>
      currentItems.map(item => {
        if (item._id === productId) {
          const newQuantity = Math.max(0, (item.quantity ?? 0) + change);
          // Set the item to be debounced, which will trigger the useEffect
          setDebouncedItem({ productId, quantity: newQuantity });
          // Optimistically update the UI
          return { ...item, quantity: newQuantity, isAvailable: newQuantity > 0 };
        }
        return item;
      })
    );
  }, []); // Empty dependency array as it has no external dependencies

  const handleRowClick = useCallback((item: (typeof filteredItems)[number]) => {
    // For non-restaurants, if a product has options, open the options management drawer.
    if (storeType !== 'restaurant' && item.options && item.options.length > 0) {
      setEditingOptionsFor(item as ProductWithOptions);
    } else {
      // For other cases, you could open a general product detail view or do nothing.
    }
  }, [storeType]);

  if (inventoryDetails === undefined) {
    return <InventoryTabSkeleton />;
  }

  if (!inventoryDetails) {
    return (
      <div className="flex items-center justify-center h-64 rounded-lg border border-dashed">
        <p className="text-muted-foreground">No inventory data available.</p>
      </div>
    );
  }

  const { summary } = inventoryDetails;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-300">Total Items</CardTitle>
            <Package className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalItems}</div>
            <p className="text-xs text-muted-foreground">Total distinct menu items</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-300">Available</CardTitle>
            <PackageCheck className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.availableItems}</div>
            <p className="text-xs text-muted-foreground">Items currently in stock</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-300">Out of Stock</CardTitle>
            <PackageX className="h-4 w-4 text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.unavailableItems}</div>
            <p className="text-xs text-muted-foreground">Items currently unavailable</p>
          </CardContent>
        </Card>
      </div>

      {/* Items Table */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader className="space-y-4">
          <CardTitle>Menu Items</CardTitle>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="relative w-full sm:flex-grow">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by item name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full bg-gray-800/60 border-gray-700 focus:ring-purple-500"
              />
            </div>
            <Tabs value={filterStatus} onValueChange={setFilterStatus} className="w-full sm:w-auto">
              <TabsList className="grid w-full grid-cols-3 bg-gray-900/60 border border-gray-800 rounded-lg p-1 h-auto">
                <TabsTrigger value="all" className="text-gray-400 data-[state=active]:bg-gray-700/50 data-[state=active]:text-white rounded-md">All</TabsTrigger>
                <TabsTrigger value="available" className="text-gray-400 data-[state=active]:bg-gray-700/50 data-[state=active]:text-white rounded-md">Available</TabsTrigger>
                <TabsTrigger value="unavailable" className="text-gray-400 data-[state=active]:bg-gray-700/50 data-[state=active]:text-white rounded-md">Out of Stock</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-b-gray-800 hover:bg-gray-900/30">
                <TableHead className="w-[60px] text-gray-400 font-semibold">Image</TableHead>
                <TableHead className="text-gray-400 font-semibold min-w-[150px]">Name</TableHead>
                <TableHead className="text-gray-400 font-semibold">Category</TableHead>
                <TableHead className="text-gray-400 font-semibold">Options</TableHead>
                <TableHead className="text-gray-400 font-semibold">{storeType === 'restaurant' ? 'Status' : 'Quantity'}</TableHead>
                <TableHead className="text-right text-gray-400 font-semibold">Toggle Availability</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length > 0 ? (
                filteredItems.map((item) => (
                  <TableRow 
                    key={item._id} 
                    className={`border-gray-800 hover:bg-gray-900/50 ${storeType !== 'restaurant' && item.options && item.options.length > 0 ? 'cursor-pointer' : ''}`}
                    onClick={() => handleRowClick(item)}
                    title={storeType !== 'restaurant' && item.options && item.options.length > 0 ? 'Click to manage option stock' : ''}
                  >
                    <TableCell>
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="w-10 h-10 rounded-lg object-cover" />
                      ) : (
                        <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center">
                          <Package size={20} className="text-gray-500" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-gray-100 truncate">{item.name}</TableCell>
                    <TableCell className="text-gray-400">{item.category}</TableCell>
                    <TableCell>
                      {storeType !== 'restaurant' && item.options && item.options.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {(() => {
                            const allChoices = item.options.flatMap(opt => opt.choices);
                            const displayChoices = allChoices.slice(0, 1);
                            const hasMore = allChoices.length > 1;

                            return (
                              <>
                                {displayChoices.map((choice, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs font-normal border-gray-700 bg-gray-800 text-gray-300">
                                    {choice.name}: <span className="font-mono ml-1.5 text-purple-300">{choice.quantity ?? 'N/A'}</span>
                                  </Badge>
                                ))}
                                {hasMore && <Badge variant="outline" className="text-xs font-normal border-gray-700 bg-gray-800 text-gray-400">...</Badge>}
                              </>
                            );
                          })()}
                        </div>
                      ) : (
                        <span className="text-gray-600 text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {storeType === 'restaurant' ? (
                        <Badge variant="outline" className={item.isAvailable ? 'border-green-500/40 bg-green-500/10 text-green-400' : 'border-red-500/40 bg-red-500/10 text-red-400'}>
                          {item.isAvailable ? 'Available' : 'Out of Stock'}
                        </Badge>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-gray-700" onClick={(e) => { e.stopPropagation(); handleQuantityChange(item._id, -1); }}>
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className={`font-semibold w-20 text-center ${
                            (item.quantity ?? 0) > 10 ? 'text-green-400' : 
                            (item.quantity ?? 0) > 0 ? 'text-yellow-400' : 'text-red-400'
                          }`}>
                            {item.quantity ?? 0} in stock
                          </span>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-gray-700" onClick={(e) => { e.stopPropagation(); handleQuantityChange(item._id, 1); }}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div onClick={(e) => e.stopPropagation()}>
                        <Switch 
                          checked={item.isAvailable}
                          onCheckedChange={(checked) => handleAvailabilityChange(item._id, checked)}
                          aria-label={`Toggle availability for ${item.name}`}
                          className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-600"
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    No items match your search or filter criteria.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Drawer for Managing Option Quantities */}
      <Drawer.Root open={!!editingOptionsFor} onOpenChange={(isOpen) => !isOpen && setEditingOptionsFor(null)}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/40" />
          <Drawer.Content className="bg-gray-800 flex flex-col rounded-t-[10px] h-[90%] mt-24 fixed bottom-0 left-0 right-0 z-50 border-t border-gray-700">
            {editingOptionsFor && (
              <ManageOptionsInventory product={editingOptionsFor} onClose={() => setEditingOptionsFor(null)} />
            )}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}

const InventoryTabSkeleton = () => (
  <div className="space-y-6">
    <div className="grid gap-4 md:grid-cols-3">
      {[...Array(3)].map((_, i) => (
        <Card key={i} className="bg-gray-900/50 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-24 bg-gray-700" />
            <Skeleton className="h-4 w-4 bg-gray-700" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16 bg-gray-700" />
            <Skeleton className="h-3 w-32 mt-2 bg-gray-700" />
          </CardContent>
        </Card>
      ))}
    </div>
    <Card className="bg-gray-900/50 border-gray-800">
      <CardHeader className="space-y-4">
        <Skeleton className="h-7 w-32 bg-gray-700" />
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Skeleton className="h-10 w-full flex-grow bg-gray-700" />
          <Skeleton className="h-10 w-full sm:w-64 bg-gray-700" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex justify-between items-center p-2 border-b border-gray-800 last:border-b-0">
            <Skeleton className="h-5 w-2/5 bg-gray-700" />
            <Skeleton className="h-5 w-1/5 bg-gray-700" />
            <Skeleton className="h-5 w-1/5 bg-gray-700" />
            <Skeleton className="h-6 w-12 rounded-full bg-gray-700" />
          </div>
        ))}
      </CardContent>
    </Card>
  </div>
);