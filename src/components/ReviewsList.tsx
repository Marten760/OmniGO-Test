import { ThumbsUp, Flag, Star, StarHalf } from "lucide-react";

interface ReviewsListProps {
  reviews: any[];
}

export function ReviewsList({ reviews }: ReviewsListProps) {
  if (!reviews || reviews.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-900/50 border border-gray-700 rounded-2xl max-w-md mx-auto">
        <div className="text-4xl mb-4">💬</div>
        <h3 className="text-lg font-semibold text-white mb-2">No reviews yet</h3>
        <p className="text-gray-400">Be the first to review this store!</p>
      </div>
    );
  }

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating - fullStars >= 0.5;

    // Full stars
    for (let i = 0; i < fullStars; i++) {
      stars.push(<Star key={`full-${i}`} size={14} className="text-yellow-400 fill-yellow-400" />);
    }

    // Half star
    if (hasHalfStar) {
      stars.push(<StarHalf key="half" size={14} className="text-yellow-400 fill-yellow-400" />);
    }

    // Empty stars
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(<Star key={`empty-${i}`} size={14} className="text-gray-500" />);
    }

    return stars;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-white">Customer Reviews</h3>
      
      <div className="space-y-4">
        {reviews.map((review) => {
          // Construct the full name from the profile, falling back to the userName
          const displayName = [review.userProfile?.firstName, review.userProfile?.lastName].filter(Boolean).join(' ') || review.userName;
          
          return (
            <div key={review._id} className="bg-gray-800 border border-gray-700 rounded-2xl p-3 sm:p-5 overflow-hidden">
            <div className="flex items-start space-x-2 sm:space-x-4">
              <div className="flex-shrink-0">
                {review.userImage ? (
                  <img
                    src={review.userImage}
                    alt={review.userName}
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">{displayName.charAt(0).toUpperCase()}</span>
                  </div>
                )}
              </div>
              
              <div className="flex-1">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2 gap-2 md:gap-0">
                  <div>
                    <h4 className="font-semibold text-white">{displayName}</h4>
                    <div className="flex items-center space-x-2">
                      <div className="flex">
                        {renderStars(review.rating)}
                      </div>
                      <span className="text-sm text-gray-400">
                        {formatDate(review._creationTime)}
                      </span>
                    </div>
                  </div>
                  
                  {review.isVerifiedPurchase && (
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium self-start md:self-center ${
                      review.isVerifiedPurchase 
                        ? "bg-green-500/20 text-green-300" 
                        : "bg-gray-700 text-gray-400"
                    }`}>
                      {review.isVerifiedPurchase ? "Verified Purchase" : "Unverified Purchase"}
                    </span>
                  )}
                </div>
                
                <p className="text-gray-300 mb-3">{review.comment}</p>
                
                {review.imageUrls && review.imageUrls.length > 0 && (
                  <div className="flex space-x-2 mb-3">
                    {review.imageUrls.map((url: string, index: number) => (
                      <img
                        key={index}
                        src={url}
                        alt={`Review image ${index + 1}`}
                        className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg object-cover"
                      />
                    ))}
                  </div>
                )}
                
                <div className="flex items-center space-x-4 sm:space-x-6 text-sm text-gray-400">
                  <button className="flex items-center space-x-1.5 hover:text-purple-400 transition-colors">
                    <ThumbsUp size={14} /> <span>Helpful ({review.helpfulCount})</span>
                  </button>
                  <button className="flex items-center space-x-1.5 hover:text-red-400 transition-colors">
                    <Flag size={14} /> <span>Report</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
