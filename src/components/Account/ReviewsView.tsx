import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { ArrowLeft, Star, Edit, Trash2, Flag, MessageSquare } from "lucide-react";

const Card = ({ className, children }: { className?: string; children: React.ReactNode }) => (
    <div className={`bg-gray-800 border border-gray-700 rounded-2xl ${className}`}>{children}</div>
);
const CardContent = ({ className, children }: { className?: string, children: React.ReactNode }) => (
    <div className={className}>{children}</div>
);
const Button = ({ onClick, className, children, disabled, type }: { onClick?: (e?: any) => void, className?: string, children: React.ReactNode, disabled?: boolean, type?: "submit" | "button" | "reset" }) => (
    <button onClick={onClick} className={className} disabled={disabled} type={type}>{children}</button>
);

function EditReviewForm({ review, onSave, onCancel }: { review: any, onSave: (reviewId: Id<"reviews">, rating: number, comment: string) => void, onCancel: () => void }) {
    const [rating, setRating] = useState(review.rating);
    const [comment, setComment] = useState(review.comment);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(review._id, rating, comment);
    };

    return (
        <Card className="animate-fade-in bg-gray-700/50">
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
                <h4 className="font-semibold text-white">Editing review for {review.storeName}</h4>
                <div>
                    <label className="text-sm text-gray-400">Your Rating</label>
                    <div className="flex items-center gap-1 mt-1">
                        {[...Array(5)].map((_, i) => (
                            <button type="button" key={i} onClick={() => setRating(i + 1)}>
                                <Star
                                    size={24}
                                    className={`transition-colors ${i < rating ? "text-yellow-400 fill-yellow-400" : "text-gray-600 hover:text-yellow-500"}`}
                                />
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                    <label className="text-sm text-gray-400">Your Comment</label>
                    <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        rows={3}
                        required
                        className="w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white"
                    />
                </div>
                <div className="flex justify-end gap-4">
                    <Button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg">Cancel</Button>
                    <Button type="submit" className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg">Save Changes</Button>
                </div>
            </form>
        </Card>
    );
}

export function ReviewsView({ onBack }: { onBack: () => void }) {
    const sessionToken = useMemo(() => localStorage.getItem("sessionToken"), []);
    const reviews = useQuery(api.reviews.getUserReviews, sessionToken ? { tokenIdentifier: sessionToken } : "skip");
    const [editingReview, setEditingReview] = useState<any | null>(null);
    const deleteReview = useMutation(api.reviews.deleteReview);
    const updateReview = useMutation(api.reviews.updateReview);
    const reportReview = useMutation(api.reviews.reportReview);

    const handleDelete = (reviewId: Id<"reviews">) => {
        if (!sessionToken) return;
        toast.promise(deleteReview({ tokenIdentifier: sessionToken, reviewId }), {
            loading: 'Deleting review...',
            success: 'Review deleted.',
            error: 'Failed to delete review.',
        });
    };

    const handleUpdate = (reviewId: Id<"reviews">, rating: number, comment: string) => {
        if (!sessionToken) return;
        toast.promise(updateReview({ tokenIdentifier: sessionToken, reviewId, rating, comment }), {
            loading: 'Updating review...',
            success: () => {
                setEditingReview(null);
                return 'Review updated successfully!';
            },
            error: (err) => err.data || 'Failed to update review.',
        });
    };

    const handleReport = (reviewId: Id<"reviews">) => {
        if (!sessionToken) return;
        toast.promise(reportReview({ tokenIdentifier: sessionToken, reviewId }), {
            loading: 'Submitting report...',
            success: 'Review reported. Thank you for your feedback.',
            error: (err) => err.data || 'Failed to report review.',
        });
    };

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div className="flex items-center space-x-4 mb-6">
                <button onClick={onBack} className="p-2 hover:bg-gray-700 rounded-full transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <h3 className="text-xl font-bold text-white">My Reviews & Ratings</h3>
            </div>

            {reviews === undefined ? (
                <p className="text-center text-gray-400 py-10">Loading reviews...</p>
            ) : reviews.length === 0 ? (
                <div className="text-center py-16 bg-gray-800/50 border border-dashed border-gray-700 rounded-2xl">
                    <MessageSquare size={48} className="mx-auto text-gray-600 mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">No Reviews Yet</h3>
                    <p className="text-gray-400">Your reviews for completed orders will appear here.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {reviews.map((review) => (
                        editingReview && editingReview._id === review._id ? (
                            <EditReviewForm
                                key={review._id}
                                review={editingReview}
                                onSave={handleUpdate}
                                onCancel={() => setEditingReview(null)}
                            />
                        ) : (
                            <Card key={review._id}>
                                <CardContent className="p-4">
                                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <h4 className="font-semibold text-white">{review.storeName}</h4>
                                            <div className="flex items-center gap-1 mt-1">
                                                {[...Array(5)].map((_, i) => (
                                                    <Star
                                                        key={i}
                                                        size={16}
                                                        className={i < review.rating ? "text-yellow-400 fill-yellow-400" : "text-gray-600"}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 mt-2 sm:mt-0 self-end sm:self-start">
                                            <button onClick={() => setEditingReview(review)} className="p-2 text-gray-400 hover:text-white"><Edit size={16} /></button>
                                            <button onClick={() => handleDelete(review._id)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                                            <button onClick={() => handleReport(review._id)} className="p-2 text-gray-400 hover:text-yellow-500" title="Report review"><Flag size={16} /></button>
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-300 mt-3 pt-3 border-t border-gray-700">{review.comment}</p>
                                    {review.imageUrls && review.imageUrls.length > 0 && (
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {review.imageUrls.map((url: string, index: number) => (
                                                <img key={index} src={url} alt={`Review image ${index + 1}`} className="w-16 h-16 object-cover rounded-lg cursor-pointer" onClick={() => window.open(url, '_blank')} />
                                            ))}
                                        </div>
                                    )}
                                    <p className="text-xs text-gray-500 text-right mt-2">{new Date(review._creationTime).toLocaleDateString()}</p>
                                </CardContent>
                            </Card>
                        )
                    ))}
                </div>
            )}
        </div>
    );
}