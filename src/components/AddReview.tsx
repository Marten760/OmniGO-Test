import { useState, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import { Star, Upload, X } from "lucide-react";
import { compressImage } from "../lib/imageUtils";

interface AddReviewProps {
  storeId: Id<"stores">;
}

export function AddReview({ storeId }: AddReviewProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [images, setImages] = useState<File[]>([]);

  const addReview = useMutation(api.reviews.addReview);
  const generateUploadUrl = useMutation(api.reviews.generateUploadUrl);
  const sessionToken = useMemo(() => localStorage.getItem("sessionToken"), []);
  const hasReviewed = useQuery(api.reviews.hasUserReviewedStore, sessionToken ? { storeId, tokenIdentifier: sessionToken } : "skip");

  if (hasReviewed) {
    return null; // Or show a "You've already reviewed this" message
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }
    
    if (comment.trim().length < 10) {
      toast.error("Please write a review with at least 10 characters");
      return;
    }

    if (!sessionToken) {
      toast.error("You must be logged in to leave a review.");
      return;
    }

    setIsSubmitting(true);
    
    try {
      const compressionPromises = images.map(image => 
        compressImage(image, { maxWidth: 1024, quality: 0.8 })
      );
      const compressedImages = await Promise.all(compressionPromises);

      const uploadedImageIds = await Promise.all(
        compressedImages.map(async (image) => {
          const uploadUrl = await generateUploadUrl();
          const result = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": image.type },
            body: image,
          });
          if (!result.ok) {
            throw new Error(`Failed to upload image: ${image.name}`);
          }
          const { storageId } = await result.json();
          return storageId as Id<"_storage">;
        })
      );

      await addReview({
        tokenIdentifier: sessionToken,
        storeId: storeId,
        rating,
        comment: comment.trim(),
        imageIds: uploadedImageIds,
      });
      
      toast.success("Review added successfully!");
      setRating(0);
      setComment("");
      setImages([]);
    } catch (error: any) {
      toast.error(error.message || "Failed to add review");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newImages = Array.from(e.target.files).slice(0, 5 - images.length);
      setImages((prev) => [...prev, ...newImages]);
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const renderStarInput = () => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <button
          key={i}
          type="button"
          onClick={() => setRating(i)}
          onMouseEnter={() => setHoveredRating(i)}
          onMouseLeave={() => setHoveredRating(0)}
          className="p-1 transition-transform duration-150 ease-in-out hover:scale-125 focus:outline-none"
        >
          <Star
            size={28}
            className={`transition-colors ${i <= (hoveredRating || rating) ? "text-yellow-400 fill-yellow-400" : "text-gray-600"}`}
          />
        </button>
      );
    }
    return stars;
  };

  return (
    <div className="bg-gray-900/50 border border-gray-700 rounded-2xl p-4 sm:p-6">
      <h3 className="text-xl font-bold text-white mb-4">Write a Review</h3>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Your Rating
          </label>
          <div className="flex space-x-1">
            {renderStarInput()}
          </div>
        </div>
        
        <div>
          <label htmlFor="comment" className="block text-sm font-medium text-gray-300 mb-2">
            Your Review
          </label>
          <textarea
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your experience with this store..."
            rows={4}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-white placeholder-gray-500"
            maxLength={500}
          />
          <p className="text-xs text-gray-400 text-right mt-2">
            {comment.length}/500 characters
          </p>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Add Photos (Optional)
          </label>
          <div className="border-2 border-dashed border-gray-600 rounded-xl p-4">
            <input type="file" id="review-images" accept="image/*" multiple onChange={handleImageChange} className="hidden" disabled={images.length >= 5} />
            <label htmlFor="review-images" className={`text-center block cursor-pointer ${images.length >= 5 ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-purple-400 hover:text-purple-300 font-semibold">Click to upload</p>
              <p className="text-xs text-gray-500">You can add up to 5 images.</p>
            </label>
            {images.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-3">
                {images.map((file, index) => (
                  <div key={index} className="relative group">
                    <img src={URL.createObjectURL(file)} alt={`preview ${index}`} className="w-20 h-20 object-cover rounded-lg" />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(index)}
                      className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full p-0.5 leading-none opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || rating === 0 || comment.trim().length < 10}
          className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-3 rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-lg hover:scale-105 active:scale-100"
        >
          {isSubmitting ? "Submitting..." : "Submit Review"}
        </button>
      </form>
    </div>
  );
}
