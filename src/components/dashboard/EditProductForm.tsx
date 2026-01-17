import { useState, useMemo, DragEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api"; // Corrected path
import { Doc, Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { Upload, Camera, ArrowLeft, Plus, Trash2, Settings, Check, X, Edit, Loader2 } from "lucide-react";
import { Reorder } from "framer-motion";

type ProductWithUrl = NonNullable<ReturnType<typeof useQuery<typeof api.products.getStoreProductsFlat>>>[number] & { imageUrls: string[] };

interface EditProductFormProps {
  product: ProductWithUrl; // This object contains the storeId
  storeType: Doc<"stores">["storeType"];
  onBack: () => void;
  storeId?: Id<"stores">; // Make prop optional as we have a fallback
}

type ImageState = 
  | { type: 'existing', url: string, id: Id<"_storage"> }
  | { type: 'new', file: File, url: string, id: string };

type DraggableImage = ImageState & { uniqueKey: string };

export function EditProductForm({ product, storeType, onBack, storeId }: EditProductFormProps) {
  const sessionToken = useMemo(() => localStorage.getItem("sessionToken"), []);
  const updateProduct = useMutation(api.products.updateProduct);
  const generateUploadUrl = useMutation(api.stores.generateUploadUrl);

  const [formState, setFormState] = useState({
    name: product.name,
    description: product.description,
    price: product.price,
    category: product.category,
    isVegetarian: product.dietaryInfo?.includes("Vegetarian") ?? false,
    isVegan: product.dietaryInfo?.includes("Vegan") ?? false,
    isGlutenFree: product.dietaryInfo?.includes("Gluten-Free") ?? false,
    spiceLevel: product.spiceLevel || "none",
    quantity: product.quantity ?? "",
    options: product.options?.map(o => ({ ...o, choices: o.choices.map(c => ({ ...c, ingredients: c.ingredients || '' })) })) || []
  });
  const [images, setImages] = useState<ImageState[]>(
    (product.imageUrls || []).map((url, i) => ({ type: 'existing', url, id: product.imageIds![i] }))
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isManagingCategories, setIsManagingCategories] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<Id<"productCategories"> | null>(null);
  const [isCategoryActionLoading, setIsCategoryActionLoading] = useState<Id<"productCategories"> | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");

  // Use the passed storeId, or fall back to the one from the product.
  const effectiveStoreId = storeId || product.storeId;
  const categories = useQuery(api.productCategories.getForStore, effectiveStoreId ? { storeId: effectiveStoreId } : "skip");
  const addCategory = useMutation(api.productCategories.addCategory);
  const updateCategory = useMutation(api.productCategories.updateCategory);
  const deleteCategory = useMutation(api.productCategories.deleteCategory);

  const handleEditCategory = (category: Doc<"productCategories">) => {
    setEditingCategoryId(category._id);
    setEditingCategoryName(category.name);
  };

  const handleCancelEdit = () => {
    setEditingCategoryId(null);
    setEditingCategoryName("");
  };

  const handleSaveCategory = async (categoryId: Id<"productCategories">) => {
    if (!editingCategoryName.trim()) {
      toast.error("Category name cannot be empty.");
      return;
    }
    setIsCategoryActionLoading(categoryId);
    if (!sessionToken) {
      toast.error("Authentication error. Please log in again.");
      return;
    }
    try {
      await updateCategory({ categoryId, newName: editingCategoryName.trim(), tokenIdentifier: sessionToken });
      toast.success("Category updated successfully.");
      handleCancelEdit();
    } catch (error: any) {
      toast.error(error.message || "Failed to update category.");
    } finally {
      setIsCategoryActionLoading(null);
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormState(prev => ({ ...prev, [name]: checked }));
  };

  // Handlers for managing options
  const handleAddOptionGroup = () => {
    setFormState(prev => ({
      ...prev,
      options: [...prev.options, { title: '', type: 'single', choices: [{ name: '', price_increment: 0, ingredients: '', quantity: 0 }] }]
    }));
  };

  const handleRemoveOptionGroup = (index: number) => {
    setFormState(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }));
  };

  const handleOptionGroupChange = (index: number, field: 'title' | 'type', value: string) => {
    setFormState(prev => {
      const newOptions = [...prev.options];
      newOptions[index] = { ...newOptions[index], [field]: value };
      return { ...prev, options: newOptions };
    });
  };

  const handleAddChoice = (groupIndex: number) => {
    setFormState(prev => {
      const newOptions = [...prev.options];
      newOptions[groupIndex].choices.push({ name: '', price_increment: 0, ingredients: '', quantity: 0 });
      return { ...prev, options: newOptions };
    });
  };

  const handleRemoveChoice = (groupIndex: number, choiceIndex: number) => {
    setFormState(prev => {
      const newOptions = [...prev.options];
      newOptions[groupIndex].choices = newOptions[groupIndex].choices.filter((_, i) => i !== choiceIndex);
      return { ...prev, options: newOptions };
    });
  };

  const handleChoiceChange = (groupIndex: number, choiceIndex: number, field: 'name' | 'price_increment' | 'ingredients' | 'quantity', value: string | number) => {
    setFormState(prev => {
      // Create a deep copy to avoid state mutation
      const newOptions = JSON.parse(JSON.stringify(prev.options));
      const updatedValue = (field === 'price_increment' || field === 'quantity') ? Number(value) : value;
      
      // Safely update the nested value
      if (newOptions[groupIndex] && newOptions[groupIndex].choices[choiceIndex]) {
        newOptions[groupIndex].choices[choiceIndex][field] = updatedValue;
      }
      
      return { ...prev, options: newOptions };
    });
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    if (!effectiveStoreId) {
      toast.error("Error: Store ID is missing. Cannot add category.");
      return;
    }
    if (!sessionToken) {
      toast.error("Authentication error. Please log in again.");
      return;
    }

    // Client-side check for duplicates (case-insensitive)
    const trimmedNewName = newCategoryName.trim().toLowerCase();
    if (categories?.some(cat => cat.name.toLowerCase() === trimmedNewName)) {
      toast.error(`Category "${newCategoryName.trim()}" already exists.`);
      setNewCategoryName(""); // Clear the input
      return;
    }

    try {
      await addCategory({ storeId: effectiveStoreId, name: newCategoryName, tokenIdentifier: sessionToken });
      toast.success(`Category "${newCategoryName}" added.`);
      setNewCategoryName("");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDeleteCategory = async (categoryId: Id<"productCategories">, categoryName: string) => {
    if (formState.category === categoryName) {
      toast.error("Cannot delete the currently selected category.");
      return;
    }
    if (confirm(`Are you sure you want to delete the category "${categoryName}"? This cannot be undone.`)) {
      if (!sessionToken) {
        toast.error("Authentication error. Please log in again.");
        return;
      }
      try {
        await deleteCategory({ categoryId, tokenIdentifier: sessionToken });
        toast.success(`Category "${categoryName}" deleted.`);
      } catch (error: any) {
        toast.error(error.message);
      }
    }
  };

  const handleImageUpload = async (files: File[]): Promise<Id<"_storage">[]> => {
    if (!sessionToken) {
      throw new Error("Authentication error: No session token found.");
    }
    const uploadPromises = files.map(async (file) => {
      const uploadUrl = await generateUploadUrl();
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!result.ok) throw new Error(`Failed to upload image: ${file.name}`);
      const { storageId } = await result.json();
      return storageId as Id<"_storage">;
    });
    return Promise.all(uploadPromises);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formState.price <= 0) {
      toast.error("Price must be greater than zero.");
      return;
    }

    setIsSubmitting(true);
    if (!sessionToken) {
      toast.error("Authentication error. Please log in again.");
      setIsSubmitting(false);
      return;
    }
    try {
      const newFiles = images.filter(img => img.type === 'new').map(img => (img as { type: 'new', file: File }).file);
      const newImageIds = await handleImageUpload(newFiles);

      const existingImageIds = images
        .filter(img => img.type === 'existing')
        .map(img => (img as { type: 'existing', id: Id<"_storage"> }).id);

      const finalImageIds = [...existingImageIds, ...newImageIds];

      const { ...formData } = formState;
      await updateProduct({
        ...formData,
        productId: product._id,
        tokenIdentifier: sessionToken,
        price: Number(formData.price),
        quantity: storeType !== 'restaurant' ? Number(formData.quantity) || 0 : undefined,
        imageIds: finalImageIds,
        options: formData.options,
      });
      toast.success("Product updated successfully!");
      onBack();
    } catch (error) {
      console.error("Update item error:", error);
      toast.error("Failed to update product.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center space-x-4 mb-6">
        <button onClick={onBack} className="p-2 hover:bg-gray-700 rounded-full transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h3 className="text-xl font-bold text-white">Edit Product</h3>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Image Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Item Image</label>
          <div className="border-2 border-dashed border-gray-600 rounded-xl p-4">
            {images.length > 0 ? (              
              <Reorder.Group
                axis="x"
                values={images}
                onReorder={setImages}
                className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3"
              >
                {images.map((image, index) => (
                  <Reorder.Item key={image.id} value={image} className="relative group aspect-square cursor-grab">
                    <img src={image.url} alt={`Preview ${index + 1}`} className="w-full h-full object-cover rounded-lg" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button type="button" onClick={() => setImages(prev => prev.filter((_, i) => i !== index))} className="text-white p-1 bg-red-600/80 rounded-full">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </Reorder.Item>
                ))}
                <label htmlFor="food-item-image-add" className="flex items-center justify-center aspect-square border-2 border-dashed border-gray-500 rounded-lg cursor-pointer hover:bg-gray-700/50">
                  <Plus size={24} className="text-gray-400" />
                </label>
              </Reorder.Group>
            ) : (
              <div className="text-center p-6">
                <Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-400 mb-2">Drag & drop images here, or click to upload</p>
                <label htmlFor="food-item-image-add" className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg cursor-pointer inline-flex items-center space-x-2">
                  <Upload size={18} />
                  <span>Choose Images</span>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Name, Price, Category */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input type="file" multiple accept="image/*" onChange={(e) => setImages(prev => [...prev, ...Array.from(e.target.files || []).map((file): ImageState => ({ type: 'new', file, url: URL.createObjectURL(file), id: file.name + Date.now() }))])} className="hidden" id="food-item-image-add" />
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Name *</label>
            <input type="text" name="name" required value={formState.name} onChange={handleInputChange} className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white focus:border-purple-500 focus:ring-purple-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Price (π) *</label>
            <input type="number" name="price" required step="0.0000001" value={formState.price} onChange={handleInputChange} className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white focus:border-purple-500 focus:ring-purple-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Category *</label>
            <div className="flex items-center gap-2">
              <select name="category" required value={formState.category} onChange={handleInputChange} className="flex-grow w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white focus:border-purple-500 focus:ring-purple-500">
                <option value="" disabled>Select a category</option>
                {categories?.map(category => (
                  <option key={category._id} value={category.name}>{category.name}</option>
                ))}
              </select>
              <button type="button" onClick={() => setIsManagingCategories(!isManagingCategories)} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-xl transition-colors">
                <Settings size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Category Management Modal */}
        {isManagingCategories && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-gray-800 w-full max-w-md rounded-2xl border border-gray-700 shadow-2xl flex flex-col max-h-[80vh]">
              <div className="flex items-center justify-between p-4 border-b border-gray-700">
                <h3 className="text-lg font-semibold text-white">Manage Categories</h3>
                <button onClick={() => setIsManagingCategories(false)} className="p-2 rounded-full hover:bg-gray-700 transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="p-4 space-y-3 overflow-y-auto">
                {categories?.map((cat) => (
                  editingCategoryId === cat._id ? (
                    <div key={cat._id} className="flex items-center gap-2 bg-gray-900/50 p-2 rounded-lg border border-purple-500">
                      <input
                        type="text"
                        value={editingCategoryName}
                        onChange={(e) => setEditingCategoryName(e.target.value)}
                        className="flex-grow bg-gray-700 border-gray-600 rounded-md px-2 py-1 text-white"
                        autoFocus
                      />
                      {isCategoryActionLoading === cat._id ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" /> : (
                        <>
                          <button type="button" onClick={() => handleSaveCategory(cat._id)} className="p-1.5 text-green-400 hover:bg-green-500/20 rounded-md"><Check size={18} /></button>
                          <button type="button" onClick={handleCancelEdit} className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-md"><X size={18} /></button>
                        </>
                      )}
                    </div>
                  ) : (
                    <div key={cat._id} className="flex items-center justify-between bg-gray-700/50 p-3 rounded-lg group">
                      <span className="text-gray-200">{cat.name}</span>
                      <div className="flex items-center gap-2">
                        {isCategoryActionLoading === cat._id ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : <>
                        <button type="button" onClick={() => handleEditCategory(cat)} className="text-gray-400 hover:text-purple-400 p-1 rounded-full transition-colors">
                          <Edit size={16} />
                        </button>
                        <button type="button" onClick={() => handleDeleteCategory(cat._id, cat.name)} className="text-gray-400 hover:text-red-500 p-1 rounded-full transition-colors">
                          <Trash2 size={16} />
                        </button>
                        </>}
                      </div>
                    </div>
                  )
                ))}
              </div>

              <div className="p-4 border-t border-gray-700 mt-auto">
                <div className="flex gap-2">
                  <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Add new category..." className="flex-grow bg-gray-700 border-gray-600 rounded-lg px-3 py-2 text-white placeholder:text-gray-500" />                  <button type="button" onClick={handleAddCategory} className="bg-purple-600 text-white p-2 sm:px-4 sm:py-2 rounded-lg hover:bg-purple-700 transition-colors font-semibold flex items-center gap-2 shrink-0">
                    <Plus size={16} />
                    <span className="hidden sm:inline">Add</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quantity for non-restaurants */}
        {storeType !== 'restaurant' && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Quantity *</label>
            <input type="number" name="quantity" required value={formState.quantity} onChange={handleInputChange} className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white focus:border-purple-500 focus:ring-purple-500" />
          </div>
        )}

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Description *</label>
          <textarea name="description" required value={formState.description} onChange={handleInputChange} className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white focus:border-purple-500 focus:ring-purple-500" rows={3} />
        </div>

        {/* Dietary & Spice */}
        {storeType === 'restaurant' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Dietary Info</label>
              <div className="space-y-2">
                {['isVegetarian', 'isVegan', 'isGlutenFree'].map(opt => (
                  <div key={opt} className="flex items-center">
                    <input type="checkbox" id={`${opt}-edit`} name={opt} checked={formState[opt as keyof typeof formState] as boolean} onChange={handleCheckboxChange} className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500" />
                    <label htmlFor={`${opt}-edit`} className="ml-2 text-gray-300 capitalize">{opt.replace('is', '')}</label>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Spice Level</label>
              <select name="spiceLevel" value={formState.spiceLevel} onChange={handleInputChange} className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white focus:border-purple-500 focus:ring-purple-500">
                <option value="none">None</option>
                <option value="mild">Mild 🌶️</option>
                <option value="medium">Medium 🌶️🌶️</option>
                <option value="hot">Hot 🌶️🌶️🌶️</option>
                <option value="very hot">Very Hot 🌶️🌶️🌶️🌶️</option>
              </select>
            </div>
          </div>
        )}

        {/* Item Options */}
        <div className="space-y-4 p-4 border border-gray-700 rounded-2xl bg-gray-900/50">
          <h4 className="text-lg font-semibold text-white">Product Options</h4>
          {formState.options.map((option, groupIndex) => (
            <div key={groupIndex} className="p-3 sm:p-4 bg-gray-700/50 rounded-lg space-y-4 border border-gray-600">
              <div className="flex flex-col rounded-xl md:flex-row md:items-center justify-between gap-3">
                <input
                  type="text"
                  placeholder="Option Title (e.g., Size, Add-ons)"
                  value={option.title}
                  onChange={(e) => handleOptionGroupChange(groupIndex, 'title', e.target.value)}
                  className="w-full md:flex-grow bg-gray-800 border-gray-600 rounded-xl px-3 py-2 text-white text-md font-semibold"
                />
                <div className="flex items-center gap-2 self-end md:self-center">
                  <select
                    value={option.type}
                    onChange={(e) => handleOptionGroupChange(groupIndex, 'type', e.target.value)}
                    className="bg-gray-800 border-gray-600 rounded-xl px-2 py-2 text-sm text-white"
                  >
                    <option value="single">Single Choice</option>
                    <option value="multiple">Multiple Choice</option>
                  </select>
                  <button type="button" onClick={() => handleRemoveOptionGroup(groupIndex)} className="p-2 text-red-500 hover:bg-red-500/20 rounded-full">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              <div className="space-y-2">
                {option.choices.map((choice, choiceIndex) => (
                  <div key={choiceIndex} className="flex flex-col gap-3 bg-gray-800/70 p-3 rounded-lg border border-gray-600/50">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <div className="flex-grow">
                        <input
                          type="text"
                          placeholder="Choice Name (e.g., Large)"
                          value={choice.name}
                          onChange={(e) => handleChoiceChange(groupIndex, choiceIndex, 'name', e.target.value)}
                          className="w-full bg-gray-900 border-gray-700 rounded-lg px-3 py-2 text-white"
                        />
                      </div>
                      <div className="relative flex-shrink-0 w-full sm:w-32">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400">π</span>
                      <input
                        type="number"
                        step="0.0000001"
                        placeholder="Price Inc."
                        value={choice.price_increment}
                        onChange={(e) => handleChoiceChange(groupIndex, choiceIndex, 'price_increment', e.target.value)}
                        className="w-full bg-gray-900 border-gray-700 rounded-lg pl-6 pr-2 py-2 text-white"
                      />
                      </div>
                      {storeType !== 'restaurant' && (
                        <div className="relative flex-shrink-0">
                          <input
                            type="number"
                            placeholder="Qty"
                            value={choice.quantity || ''}
                            onChange={(e) => handleChoiceChange(groupIndex, choiceIndex, 'quantity', e.target.value)}
                            className="w-full sm:w-24 bg-gray-900 border-gray-700 rounded-lg px-3 py-2 text-white"
                          />
                        </div>
                      )}
                      <div className="flex-shrink-0 self-end sm:self-center">
                        <button type="button" onClick={() => handleRemoveChoice(groupIndex, choiceIndex)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-full">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    {storeType === 'restaurant' && (
                      <div>
                        <input
                          type="text"
                          placeholder="Ingredients (optional, e.g., cheese, tomato)"
                          value={choice.ingredients || ''}
                          onChange={(e) => handleChoiceChange(groupIndex, choiceIndex, 'ingredients', e.target.value)}
                          className="w-full bg-gray-900 border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              <button type="button" onClick={() => handleAddChoice(groupIndex)} className="text-purple-400 hover:text-purple-300 text-sm font-semibold flex items-center gap-1">
                <Plus size={14} /> Add Choice
              </button>
            </div>
          ))}
          
          <div className="flex justify-center pt-2">
            <button 
              type="button"
              onClick={handleAddOptionGroup} 
              className="bg-gray-700 hover:bg-gray-600 text-white p-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={20} />
              <span>Add Option Group</span>
            </button>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-4">
          <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl transition-all duration-200 font-semibold disabled:opacity-50">
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}