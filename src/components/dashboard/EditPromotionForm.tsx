import { useState, useEffect, useMemo } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Doc, Id } from '../../../convex/_generated/dataModel';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Image as ImageIcon, Upload } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { compressImage } from "../../lib/imageUtils";

interface EditPromotionFormProps {
  promotion: Doc<"promotions"> & { imageUrl?: string | null };
  onBack: () => void;
}

export function EditPromotionForm({ promotion, onBack }: EditPromotionFormProps) {
  const [formState, setFormState] = useState({
    title: '',
    description: '',
    badgeText: '',
    startDate: '',
    endDate: '',
  });
  const [newImage, setNewImage] = useState<File | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const sessionToken = useMemo(() => localStorage.getItem("sessionToken"), []);

  const updatePromotionMutation = useMutation(api.promotions.updatePromotion);
  const generateUploadUrl = useMutation(api.stores.generateUploadUrl);

  useEffect(() => {
    if (promotion) {
      setFormState({
        title: promotion.title,
        description: promotion.description || '',
        badgeText: promotion.badgeText || '',
        startDate: new Date(promotion.startDate).toISOString().split('T')[0],
        endDate: new Date(promotion.endDate).toISOString().split('T')[0],
      });
      setNewImage(null); // Reset new image on promotion change
    }
  }, [promotion]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewImage(file);
    }
  };

  const handleUpdatePromotion = async () => {
    if (!sessionToken) {
      toast.error("Authentication error. Please log in again.");
      return;
    }
    if (!formState.title || !formState.startDate || !formState.endDate) {
      toast.error("Title, start date, and end date are required.");
      return;
    }

    setIsUpdating(true);
    try {
      let imageIdToUpdate = promotion.imageId;

      if (newImage) {
        const compressedFile = await compressImage(newImage, { maxWidth: 1280, quality: 0.8 });
        const uploadUrl = await generateUploadUrl();
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": compressedFile.type },
          body: compressedFile,
        });
        const { storageId } = await result.json();
        imageIdToUpdate = storageId;
      }

      await updatePromotionMutation({
        tokenIdentifier: sessionToken,
        promotionId: promotion._id,
        title: formState.title,
        description: formState.description,
        imageId: imageIdToUpdate,
        badgeText: formState.badgeText,
        startDate: new Date(formState.startDate).toISOString(),
        endDate: new Date(formState.endDate).toISOString(),
        status: promotion.status, // Status is not editable in this form
      });

      toast.success("Promotion updated successfully.");
      onBack();
    } catch (error: any) {
      toast.error("Failed to update promotion.", { description: error.data?.message });
    } finally {
      setIsUpdating(false);
    }
  };

  const previewUrl = newImage ? URL.createObjectURL(newImage) : promotion.imageUrl;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center space-x-4 mb-6">
        <button onClick={onBack} className="p-2 hover:bg-gray-700 rounded-full transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h3 className="text-xl font-bold text-white">Edit Promotion: {promotion.title}</h3>
      </div>

      <div className="space-y-6 max-w-2xl mx-auto">
        <div>
          <Label className="font-semibold text-gray-300">Ad Image</Label>
          <div className="mt-2 border-2 border-dashed border-gray-600 rounded-xl p-6 text-center">
            {previewUrl ? (
              <div className="space-y-2">
                <img src={previewUrl} alt="Promotion preview" className="w-48 aspect-video object-cover rounded-lg mx-auto" />
                <p className="text-gray-400 text-sm">{newImage ? newImage.name : 'Current image'}</p>
                <label htmlFor="promo-image-edit" className="text-purple-400 hover:text-purple-300 font-semibold cursor-pointer">Change Image</label>
                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" id="promo-image-edit" />
              </div>
            ) : (
              <div>
                <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <label htmlFor="promo-image-edit" className="text-purple-400 hover:text-purple-300 font-semibold cursor-pointer">Choose Image</label>
                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" id="promo-image-edit" />
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="font-semibold text-gray-300">Ad Title</Label>
            <Input name="title" placeholder="e.g., 30% Off All Pizzas" value={formState.title} onChange={handleInputChange} className="border-gray-700 bg-gray-800/80 text-gray-200 rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label className="font-semibold text-gray-300">Badge Text (Optional)</Label>
            <Input name="badgeText" placeholder="e.g., 30% OFF" value={formState.badgeText} onChange={handleInputChange} className="border-gray-700 bg-gray-800/80 text-gray-200 rounded-xl" />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="font-semibold text-gray-300">Short Description (Optional)</Label>
          <Input name="description" placeholder="e.g., Limited time offer!" value={formState.description} onChange={handleInputChange} className="border-gray-700 bg-gray-800/80 text-gray-200 rounded-xl" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="font-semibold text-gray-300">Start Date</Label>
            <Input name="startDate" type="date" value={formState.startDate} onChange={handleInputChange} className="border-gray-700 bg-gray-800/80 text-gray-200 rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label className="font-semibold text-gray-300">End Date</Label>
            <Input name="endDate" type="date" value={formState.endDate} onChange={handleInputChange} className="border-gray-700 bg-gray-800/80 text-gray-200 rounded-xl" />
          </div>
        </div>

        <div className="flex justify-end gap-4 pt-4">
          <Button variant="outline" onClick={onBack} className="rounded-xl">Cancel</Button>
          <Button
            className="bg-gradient-to-r from-purple-600 to-pink-600 font-bold text-white hover:from-purple-700 hover:to-pink-700 rounded-xl"
            onClick={handleUpdatePromotion}
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