import { useState, useMemo } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { ArrowLeft, Upload, Pi, User } from "lucide-react";

const Card = ({ className, children }: { className?: string; children: React.ReactNode }) => (
    <div className={`bg-gray-800 border border-gray-700 rounded-2xl ${className}`}>{children}</div>
);
const CardContent = ({ className, children }: { className?: string, children: React.ReactNode }) => (
    <div className={className}>{children}</div>
);
const Button = ({ onClick, className, children, disabled, type }: { onClick?: () => void, className?: string, children: React.ReactNode, disabled?: boolean, type?: "submit" | "button" | "reset" }) => (
    <button onClick={onClick} className={className} disabled={disabled} type={type}>{children}</button>
);

export function ProfileInformationView({ user, onBack }: { user: any, onBack: () => void }) {
    const sessionToken = useMemo(() => localStorage.getItem("sessionToken"), []);
    const [isEditing, setIsEditing] = useState(false);
    const [firstName, setFirstName] = useState(user?.profile?.firstName || '');
    const [lastName, setLastName] = useState(user?.profile?.lastName || '');
    const [phone, setPhone] = useState(user?.profile?.phone || '');
    const [email, setEmail] = useState(user?.email || '');
    const [profileImage, setProfileImage] = useState<File | null>(null);
    const updateUserProfile = useMutation(api.auth.updateUserProfile);
    const generateUploadUrl = useMutation(api.stores.generateUploadUrl);

    const displayName = [user?.profile?.firstName, user?.profile?.lastName].filter(Boolean).join(' ') || user?.name || user?.profile?.piUsername || 'User';
    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div className="flex items-center space-x-4 mb-6">
                <button onClick={onBack} className="p-2 hover:bg-gray-700 rounded-full transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <h3 className="text-xl font-bold text-white">Profile Information</h3>
            </div>

            {/* Content */}
            <div className="space-y-6">
                {/* Profile Picture and Name */}
                <Card>
                    <CardContent className="p-6 flex items-center gap-6">
                        <div className="relative w-24 h-24">
                            <div className="w-24 h-24 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center ring-4 ring-white/10 overflow-hidden">
                                {profileImage ? (
                                    <img src={URL.createObjectURL(profileImage)} alt="Preview" className="w-full h-full object-cover" />
                                ) : user?.profile?.profileImageUrl ? (
                                    <img src={user.profile.profileImageUrl} alt="Profile" className="w-full h-full object-cover" />
                                ) : user?.profile?.piUid ? (
                                    <Pi size={48} className="text-white" />
                                ) : (
                                    <User className="h-12 w-12 text-white" />
                                )}
                            </div>
                            {isEditing && (
                                <>
                                    <input
                                        type="file"
                                        id="profile-image-upload"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => setProfileImage(e.target.files?.[0] || null)}
                                    />
                                    <label htmlFor="profile-image-upload" className="absolute bottom-0 right-0 bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-full cursor-pointer border-2 border-gray-800">
                                        <Upload size={14} />
                                    </label>
                                </>
                            )}
                        </div>
                        <div className="flex-1">
                            {isEditing ? (
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <input
                                        type="text"
                                        placeholder="First Name"
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        className="text-lg font-bold text-white bg-gray-700 border border-gray-600 rounded-lg px-3 py-1 w-full focus:ring-purple-500 focus:border-purple-500"
                                        autoFocus
                                    />
                                    <input
                                        type="text"
                                        placeholder="Last Name"
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        className="text-lg font-bold text-white bg-gray-700 border border-gray-600 rounded-lg px-3 py-1 w-full focus:ring-purple-500 focus:border-purple-500"
                                    />
                                </div>
                            ) : (
                                <h2 className="text-2xl font-bold text-white">{displayName}</h2>
                            )}
                            <p className="text-gray-400 mt-1">Your personal account</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Details */}
                <Card>
                    <CardContent className="p-6 space-y-4">
                        <div className="text-sm flex items-center">
                            <span className="font-semibold text-gray-400 w-24 inline-block flex-shrink-0">Email:</span>
                            {isEditing ? (
                                <input
                                    type="email"
                                    placeholder="Email address"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="text-sm text-white bg-gray-700 border border-gray-600 rounded-lg px-3 py-1 w-full focus:ring-purple-500 focus:border-purple-500"
                                />
                            ) : (
                                <span className="text-white">{user?.email ?? 'Not provided'}</span>
                            )}
                        </div>
                        <div className="text-sm flex items-center">
                            <span className="font-semibold text-gray-400 w-24 inline-block flex-shrink-0">Phone:</span>
                            {isEditing ? (
                                <input
                                    type="tel"
                                    placeholder="Phone number"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="text-sm text-white bg-gray-700 border border-gray-600 rounded-lg px-3 py-1 w-full focus:ring-purple-500 focus:border-purple-500"
                                />
                            ) : (
                                <span className="text-white">{user?.profile?.phone ?? 'Not provided'}</span>
                            )}
                        </div>
                        <div className="text-sm"><span className="font-semibold text-gray-400 w-24 inline-block">Pi Username:</span> <span className="text-white font-mono">{user?.profile?.piUsername ?? 'Not linked'}</span></div>
                    </CardContent>
                </Card>

                {!isEditing ? (
                    <Button onClick={() => setIsEditing(true)} className="w-full p-4 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-colors">
                        Edit Profile Information
                    </Button>
                ) : (
                    <div className="flex gap-4">
                        <Button onClick={() => setIsEditing(false)} className="w-full p-4 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-xl transition-colors">Cancel</Button>
                        <Button onClick={async () => {
                            if (!sessionToken) return;

                            const promise = (async () => {
                                let profileImageId = user?.profile?.profileImageId;
                                if (profileImage) {
                                    const uploadUrl = await generateUploadUrl();
                                    const result = await fetch(uploadUrl, {
                                        method: "POST",
                                        headers: { "Content-Type": profileImage.type },
                                        body: profileImage,
                                    });
                                    const { storageId } = await result.json();
                                    profileImageId = storageId;
                                }

                                await updateUserProfile({
                                    tokenIdentifier: sessionToken, firstName, lastName, phone, email, profileImageId
                                });
                            })();

                            toast.promise(promise, {
                                loading: 'Saving profile...',
                                success: () => {
                                    setIsEditing(false);
                                    return 'Profile updated successfully!';
                                },
                                error: (err) => err.data || 'Failed to update profile.',
                            });
                        }} className="w-full p-4 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-colors">Save Changes</Button>
                    </div>
                )}
            </div>
        </div>
    );
}