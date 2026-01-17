import { useState, useMemo } from 'react';
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Doc, Id } from "../../../convex/_generated/dataModel";
import { Plus, Loader2, Trash2, Edit, Package } from "lucide-react";
import { AddProductForm } from "./AddProductForm";
import { EditProductForm } from "./EditProductForm";
import { toast } from "sonner";

type ProductWithUrl = NonNullable<ReturnType<typeof useQuery<typeof api.products.getStoreProductsFlat>>>[number];

interface ProductsProps {
  storeId: Id<"stores">;
}

export function Products({ storeId }: ProductsProps) {
  const [view, setView] = useState<"list" | "add" | "edit">("list");
  const [selectedProduct, setSelectedProduct] = useState<ProductWithUrl | null>(null);
  const sessionToken = useMemo(() => localStorage.getItem("sessionToken"), []);

  const store = useQuery(api.stores.getStoreById, { storeId });
  const products = useQuery(api.products.getStoreProductsFlat, { storeId });
  const deleteProduct = useMutation(api.products.deleteProduct);

  const handleDeleteProduct = async (product: ProductWithUrl) => {
    if (!sessionToken) {
      toast.error("Authentication error. Please log in again.");
      return;
    }
    if (window.confirm(`Are you sure you want to delete "${product.name}"?`)) {
      try {
        await deleteProduct({ productId: product._id, tokenIdentifier: sessionToken });
        toast.success("Product deleted successfully.");
      } catch (error) {
        toast.error("Failed to delete product.");
      }
    }
  };

  if (products === undefined || !store) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  if (view === "add") {
    return <AddProductForm storeId={storeId} storeType={store.storeType} onBack={() => setView("list")} />;
  }

  if (view === "edit" && selectedProduct) {
    return <EditProductForm product={selectedProduct} storeType={store.storeType} onBack={() => setView("list")} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-white">Products</h3>
        <button
          aria-label="Add Item"
          onClick={() => setView("add")}
          className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all duration-200 font-semibold flex items-center space-x-2"
        >
          <Plus size={20} />
          <span>Add Item</span>
        </button>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-700 rounded-xl">
          <Package className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <h4 className="text-lg font-semibold text-white">No products yet</h4>
          <p className="text-gray-400">Click "Add Item" to build your product list.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((product) => (
            <div key={product._id} className="bg-gray-700/50 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {product.imageUrls && product.imageUrls.length > 0 ? (
                  <img src={product.imageUrls[0]} alt={product.name} className="w-14 h-14 rounded-xl object-cover" />
                ) : (
                  <div className="w-14 h-14 bg-gray-600 rounded-md flex items-center justify-center text-gray-400">📦</div>
                )}
                <div>
                  <p className="font-semibold text-white">{product.name}</p>
                  <p className="text-sm text-gray-400">{product.category} • π{product.price.toFixed(2)}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <button onClick={() => { setSelectedProduct(product); setView("edit"); }} className="p-2 text-gray-400 hover:text-purple-400 transition-colors rounded-full hover:bg-gray-600/50">
                  <Edit size={18} />
                </button>
                <button onClick={() => handleDeleteProduct(product)} className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-full hover:bg-gray-600/50">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}