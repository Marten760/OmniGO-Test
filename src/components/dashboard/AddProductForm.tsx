import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Doc, Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { Upload, Camera, ArrowLeft, Plus, Trash2, Edit, Check, X, Loader2, Settings } from "lucide-react";
import { Reorder } from "framer-motion";
import { compressImage } from "../../lib/imageUtils";

interface AddProductFormProps {
  storeId: Id<"stores">;
  storeType: Doc<"stores">["storeType"];
  onBack: () => void;
}

export function AddProductForm({ storeId, storeType, onBack }: AddProductFormProps) {
  const sessionToken = useMemo(() => localStorage.getItem("sessionToken"), []);
  const addProduct = useMutation(api.products.addProduct);
  const generateUploadUrl = useMutation(api.stores.generateUploadUrl);

  // Category Management Hooks
  const categories = useQuery(api.productCategories.getForStore, { storeId });
  const addCategory = useMutation(api.productCategories.addCategory);
  const updateCategory = useMutation(api.productCategories.updateCategory);
  const deleteCategory = useMutation(api.productCategories.deleteCategory);

  // Category Management State
  const [isManagingCategories, setIsManagingCategories] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState(""); 
  const [editingCategoryId, setEditingCategoryId] = useState<Id<"productCategories"> | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [isCategoryActionLoading, setIsCategoryActionLoading] = useState<Id<"productCategories"> | null>(null);

  useEffect(() => {
    // Set a default category only when categories load for the first time
    // and if no category is already selected.
    if (categories && categories.length > 0) {
      setFormState(prev => {
        if (!prev.category) { // Check inside the updater to avoid dependency
          return { ...prev, category: categories[0].name };
        }
        return prev;
      });
    }
  }, [categories]); // This effect should only run when categories data changes.

  const [formState, setFormState] = useState({
    name: "",
    description: "",
    price: 0,
    category: "",
    isVegetarian: false,
    isVegan: false,
    isGlutenFree: false,
    spiceLevel: "none",
    quantity: "",
    images: [] as File[],
    options: [] as { title: string; type: 'single' | 'multiple'; choices: { name: string; price_increment: number; ingredients?: string; quantity?: number }[] }[],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      options: prev.options.filter((_: any, i: number) => i !== index)
    }));
  };

  const handleOptionGroupChange = (index: number, field: 'title' | 'type', value: string) => {
    setFormState(prev => {
      const newOptions = JSON.parse(JSON.stringify(prev.options));
      newOptions[index][field] = value;
      return { ...prev, options: newOptions };
    });
  };

  const handleAddChoice = (groupIndex: number) => {
    setFormState(prev => {
      const newOptions = JSON.parse(JSON.stringify(prev.options));
      newOptions[groupIndex].choices.push({ name: '', price_increment: 0, ingredients: '', quantity: 0 });
      return { ...prev, options: newOptions };
    });
  };

  const handleRemoveChoice = (groupIndex: number, choiceIndex: number) => {
    setFormState(prev => {
      const newOptions = JSON.parse(JSON.stringify(prev.options));
      newOptions[groupIndex].choices = newOptions[groupIndex].choices.filter((_: any, i: number) => i !== choiceIndex);
      return { ...prev, options: newOptions };
    });
  };

  const handleChoiceChange = (groupIndex: number, choiceIndex: number, field: 'name' | 'price_increment' | 'ingredients' | 'quantity', value: string | number) => {
    const newOptions = JSON.parse(JSON.stringify(formState.options));
    const isNumericField = field === 'price_increment' || field === 'quantity';
    newOptions[groupIndex].choices[choiceIndex][field] = isNumericField ? Number(value) : value;
    setFormState(prev => ({ ...prev, options: newOptions }));
  };

  const handleImageUpload = async (files: File[]): Promise<Id<"_storage">[]> => {
    if (!sessionToken) {
      throw new Error("Authentication error: No session token found.");
    }
    const compressionPromises = files.map(file => 
      compressImage(file, { maxWidth: 1024, quality: 0.85 })
    );
    const compressedFiles = await Promise.all(compressionPromises);

    const uploadPromises = compressedFiles.map(async (file) => {
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
    if (formState.images.length === 0) {
      toast.error("Please upload at least one image for the product.");
      return;
    }
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
      const imageIds = await handleImageUpload(formState.images);
      const { images, ...formData } = formState;
      await addProduct({
        ...formData,
        price: Number(formData.price),
        isVegetarian: formData.isVegetarian,
        isVegan: formData.isVegan,
        isGlutenFree: formData.isGlutenFree,
        quantity: storeType !== 'restaurant' ? Number(formData.quantity) || 0 : undefined,
        tokenIdentifier: sessionToken,
        storeId,
        imageIds, // Pass the array of IDs
      });
      toast.success("Product added successfully!");
      onBack();
    } catch (error) {
      console.error("Add item error:", error);
      toast.error("Failed to add product.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Category Management Functions ---
  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    if (!sessionToken) {
      toast.error("Authentication error. Please log in again.");
      return;
    }
    // Client-side check for duplicates (case-insensitive)
    const trimmedNewName = newCategoryName.trim().toLowerCase();
    if (categories?.some(cat => cat.name.toLowerCase() === trimmedNewName)) {
      toast.error(`Category "${newCategoryName.trim()}" already exists.`);
      return;
    }

    try {
      await addCategory({ storeId, name: newCategoryName.trim(), tokenIdentifier: sessionToken });
      toast.success(`Category "${newCategoryName}" added.`);
      setNewCategoryName("");
    } catch (error: any) {
      toast.error(error.message || "Failed to add category.");
    }
  };

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
      // If the edited category was the selected one, update the form state
      if (formState.category === categories?.find(c => c._id === categoryId)?.name) {
        setFormState(prev => ({ ...prev, category: editingCategoryName.trim() }));
      }
      handleCancelEdit();
    } catch (error: any) {
      toast.error(error.message || "Failed to update category.");
    } finally {
      setIsCategoryActionLoading(null);
    }
  };

  const handleDeleteCategory = async (categoryId: Id<"productCategories">, categoryName: string) => {
    if (formState.category === categoryName) {
      toast.error("Cannot delete a category that is currently selected for the new item.");
      return;
    }
    setIsCategoryActionLoading(categoryId);
    if (!sessionToken) {
      toast.error("Authentication error. Please log in again.");
      return;
    }
    if (confirm(`Are you sure you want to delete the category "${categoryName}"? This cannot be undone.`)) {
      try {
        await deleteCategory({ categoryId, tokenIdentifier: sessionToken });
        toast.success(`Category "${categoryName}" deleted.`);
      } catch (error: any) {
        toast.error(error.message);
      } finally {
        setIsCategoryActionLoading(null);
      }
    } else {
      setIsCategoryActionLoading(null);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center space-x-4 mb-6">
        <button onClick={onBack} className="p-2 hover:bg-gray-700 rounded-full transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h3 className="text-xl font-bold text-white">Add New Product</h3>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Image Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Item Image *</label>
          <div className="border-2 border-dashed border-gray-600 rounded-xl p-4">
            {formState.images.length > 0 ? (
              <Reorder.Group
                axis="x"
                values={formState.images}
                onReorder={(newOrder) => setFormState(prev => ({ ...prev, images: newOrder }))}
                className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3"
              >
                {formState.images.map((image, index) => (
                  <Reorder.Item key={image.name + index} value={image} className="relative group aspect-square cursor-grab">
                    <img src={URL.createObjectURL(image)} alt={`Preview ${index + 1}`} className="w-full h-full object-cover rounded-lg" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button type="button" onClick={() => setFormState(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }))} className="text-white p-1 bg-red-600/80 rounded-full">
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
          <input type="file" multiple accept="image/*" onChange={(e) => setFormState(prev => ({ ...prev, images: [...prev.images, ...Array.from(e.target.files || [])] }))} className="hidden" id="food-item-image-add" />
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
              <select name="category" required value={formState.category} onChange={handleInputChange} className="flex-grow bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white focus:border-purple-500 focus:ring-purple-500">
                {categories === undefined && <option>Loading...</option>}
                {categories?.map(category => (
                  <option key={category._id} value={category.name}>{category.name}</option>
                ))}
                {categories?.length === 0 && <option disabled>Please add a category</option>}
              </select>
              <button type="button" onClick={() => setIsManagingCategories(prev => !prev)} className="p-2.5 bg-gray-700 hover:bg-gray-600 rounded-xl transition-colors">
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
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Add new category..."
                    className="flex-grow bg-gray-700 border-gray-600 rounded-lg px-3 py-2 text-white placeholder:text-gray-500"
                  />
                  <button type="button" onClick={handleAddCategory} className="bg-purple-600 text-white p-2 sm:px-4 sm:py-2 rounded-lg hover:bg-purple-700 transition-colors font-semibold flex items-center gap-2 shrink-0">
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
          <div className="p-4 border border-gray-700 rounded-xl">
            <h4 className="text-lg font-semibold text-white mb-4">Food-Specific Details (Optional)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Dietary Info</label>
                <div className="space-y-2">
                  {['isVegetarian', 'isVegan', 'isGlutenFree'].map(opt => (
                    <div key={opt} className="flex items-center">
                      <input type="checkbox" id={opt} name={opt} checked={formState[opt as keyof typeof formState] as boolean} onChange={handleCheckboxChange} className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500" />
                      <label htmlFor={opt} className="ml-2 text-gray-300 capitalize">{opt.replace('is', '')}</label>
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
          </div>
        )}

        {/* Item Options */}
        <div className="space-y-4 p-4 border border-gray-700 rounded-xl">
          <h4 className="text-lg font-semibold text-white">Item Options</h4>
          {formState.options.map((option, groupIndex) => (
            <div key={groupIndex} className="p-3 sm:p-4 bg-gray-700/50 rounded-xl space-y-4 border border-gray-600">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
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
                  <div key={choiceIndex} className="flex flex-col gap-2 bg-gray-800/70 p-3 rounded-lg border border-gray-600/50">
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
                      <div className="relative flex-shrink-0">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400">π</span>
                      <input
                        type="number"
                        step="0.0000001"
                        placeholder="Price Inc."
                        value={choice.price_increment}
                        onChange={(e) => handleChoiceChange(groupIndex, choiceIndex, 'price_increment', e.target.value)}
                        className="w-full sm:w-32 bg-gray-900 border-gray-700 rounded-lg pl-6 pr-2 py-2 text-white"
                      />
                      </div>
                      {storeType !== 'restaurant' && (
                        <div className="relative flex-shrink-0">
                          <input
                            type="number"
                            placeholder="Qty"
                            value={choice.quantity}
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
          
          <button type="button" onClick={handleAddOptionGroup} className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors">
            <Plus size={16} /> Add Option Group
          </button>
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-4">
          <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl transition-all duration-200 font-semibold disabled:opacity-50">
            {isSubmitting ? "Adding..." : "Add Item"}
          </button>
        </div>
      </form>
    </div>
  );
}