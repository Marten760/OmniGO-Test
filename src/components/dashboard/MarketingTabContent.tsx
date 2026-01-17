import React, { useState, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useAction } from 'convex/react';
import { Mail, MessageSquare, Loader2, Users, Target, UserCheck, MoreVertical, Edit, Trash2, TriangleAlert, Percent, DollarSign, Image as ImageIcon, Upload, Camera } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogDescription,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { api } from '../../../convex/_generated/api';
import { Doc, Id } from '../../../convex/_generated/dataModel';
import { toast } from 'sonner';
import { useAuth } from '../../hooks/useAuth';
import { EditPromotionForm } from './EditPromotionForm';
import { EditDiscountForm } from './EditDiscountForm';

interface MarketingTabContentProps {
  storeId: Id<'stores'>;
}

type DiscountType = 'percentage' | 'fixed';

export function MarketingTabContent({ storeId }: MarketingTabContentProps) {
  const [discountCode, setDiscountCode] = useState('');
  const [discountType, setDiscountType] = useState<DiscountType | undefined>();
  const [discountValue, setDiscountValue] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minOrderValue, setMinOrderValue] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [targetUsers, setTargetUsers] = useState<'all' | 'new_users_only'>('all');
  const [limitPerUser, setLimitPerUser] = useState(false);

  const [emailCampaign, setEmailCampaign] = useState({ subject: '', content: '' });
  const [promotion, setPromotion] = useState({
    title: '',
    description: '',
    badgeText: '',
    image: null as File | null,
    startDate: '',
    endDate: '',
  });

  const [isCreatingDiscount, setIsCreatingDiscount] = useState(false);
  const [isSendingCampaign, setIsSendingCampaign] = useState(false);
  const [isCreatingPromotion, setIsCreatingPromotion] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<Doc<"discounts"> | null>(null);
  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);  const [isConfirmDeletePromoDialogOpen, setIsConfirmDeletePromoDialogOpen] = useState(false);
  const [discountToDelete, setDiscountToDelete] = useState<Doc<"discounts"> | null>(null);
  const [promotionToDelete, setPromotionToDelete] = useState<Doc<"promotions"> | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Doc<"promotions"> & { imageUrl?: string | null } | null>(null);

  const { sessionToken } = useAuth();
  // Convex Hooks
  const createDiscountMutation = useMutation(api.marketing.createDiscount);
  const createPromotionMutation = useMutation(api.promotions.createOrUpdatePromotion);
  const updatePromotionMutation = useMutation(api.promotions.updatePromotion);
  const deletePromotionMutation = useMutation(api.promotions.deletePromotion);
  const promotions = useQuery(
    api.promotions.getPromotionsByStore,
    { storeId }
  );
  const generateUploadUrl = useMutation(api.stores.generateUploadUrl);  const sendCampaignAction = useAction(api.marketing.sendEmailCampaign);
  const discounts = useQuery(
    api.marketing.getDiscountsByStore,
    sessionToken ? { storeId, tokenIdentifier: sessionToken } : "skip"
  );
  const updateDiscountMutation = useMutation(api.marketing.updateDiscount);

  const deleteDiscountMutation = useMutation(api.marketing.deleteDiscount);

  const resetForm = () => {
    setDiscountCode('');
    setDiscountType(undefined);
    setDiscountValue('');
    setStartDate('');
    setEndDate('');
    setMinOrderValue('');
    setUsageLimit('');
    setTargetUsers('all');
    setLimitPerUser(false);
  };

  const handleDeleteDiscount = (discount: Doc<"discounts">) => {
    setDiscountToDelete(discount);
    setIsConfirmDeleteDialogOpen(true);
  };

  const confirmDeleteDiscount = async () => {
    if (!discountToDelete) return;
    if (!sessionToken) {
      toast.error("Authentication error. Please log in again.");
      return;
    }
    try {
      await deleteDiscountMutation({ tokenIdentifier: sessionToken, discountId: discountToDelete._id });
      toast.success("Discount deleted", { description: `Discount "${discountToDelete.code}" has been removed.` });
    } catch (error) {
      console.error("Error deleting discount:", error);
      toast.error("Error", { description: "Failed to delete discount." });
    } finally {
      setIsConfirmDeleteDialogOpen(false);
      setDiscountToDelete(null);
    }
  };
  
  const handleDeletePromotion = (promo: Doc<"promotions">) => {
    setPromotionToDelete(promo);
    setIsConfirmDeletePromoDialogOpen(true);
  };

  const confirmDeletePromotion = async () => {
    if (!promotionToDelete || !sessionToken) return;
    try {
      await deletePromotionMutation({ tokenIdentifier: sessionToken, promotionId: promotionToDelete._id });
      toast.success("Promotion deleted successfully.");
    } catch (error: any) {
      toast.error("Failed to delete promotion.", { description: error.data?.message });
    } finally {
      setIsConfirmDeletePromoDialogOpen(false);
      setPromotionToDelete(null);
    }
  };

  const handleCreateDiscount = async () => {
    if (!discountCode || !discountType || !discountValue) {
      toast.error('Error', { description: 'Please fill in all required discount fields.' });
      return;
    }

    const numericValue = parseFloat(discountValue);
    if (isNaN(numericValue) || numericValue <= 0) {
      toast.error('Invalid Value', {
        description: 'Please enter a numeric discount value greater than zero.',
      });
      return;
    }

    if (discountType === 'percentage' && numericValue > 100) {
      toast.error('Invalid Value', { description: 'Discount percentage cannot exceed 100%.' });
      return;
    }

    setIsCreatingDiscount(true);
    if (!sessionToken) {
      toast.error("Authentication error. Please log in again.");
      setIsCreatingDiscount(false);
      return;
    }
    try {
      await createDiscountMutation({
        tokenIdentifier: sessionToken,
        storeId: storeId,
        code: discountCode,
        type: discountType!,
        value: numericValue,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        minOrderValue: minOrderValue ? parseFloat(minOrderValue) : undefined,
        usageLimit: usageLimit ? parseInt(usageLimit, 10) : undefined,
        usageLimitPerUser: limitPerUser ? 1 : undefined,
        targetUsers: targetUsers,
      });
      toast.success('Success', { description: `Discount "${discountCode}" created successfully.` });
      resetForm();
    } catch (error: any) {
      console.error("Error creating discount:", error);
      toast.error('Error Creating Discount', {
        description: error.data || 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setIsCreatingDiscount(false);
    }
  };

  const handleSendCampaign = async () => {
    if (!emailCampaign.subject || !emailCampaign.content) {
      toast.error('Error', { description: 'Please fill in all campaign fields.' });
      return;
    }
    setIsSendingCampaign(true);
    if (!sessionToken) {
      toast.error("Authentication error. Please log in again.");
      setIsSendingCampaign(false);
      return;
    }
    try {
      const result = await sendCampaignAction({
        storeId: storeId,
        tokenIdentifier: sessionToken,
        subject: emailCampaign.subject,
        content: emailCampaign.content,
      });
      toast.success('Campaign Sent!', { description: `Your message has been sent to ${result.sentCount} followers.` });
      setEmailCampaign({ subject: '', content: '' });
    } catch (error: any) {
      console.error("Error sending campaign:", error);
      toast.error('Error Sending Campaign', { description: error.data?.message || 'An unexpected error occurred.' });
    } finally {
      setIsSendingCampaign(false);
    }
  };

  const handleCreatePromotion = async () => {
    if (!promotion.title || !promotion.image || !promotion.startDate || !promotion.endDate) {
      toast.error('Error', { description: 'Title, image, start date, and end date are required for a promotion.' });
      return;
    }
    if (!sessionToken) {
      toast.error("Authentication error. Please log in again.");
      return;
    }

    setIsCreatingPromotion(true);
    try {
      // 1. Upload image
      const uploadUrl = await generateUploadUrl();
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": promotion.image.type },
        body: promotion.image,
      });
      const { storageId } = await result.json();

      // 2. Create promotion
      await createPromotionMutation({
        tokenIdentifier: sessionToken,
        storeId: storeId,
        title: promotion.title,
        description: promotion.description,
        badgeText: promotion.badgeText,
        imageId: storageId,
        targetStoreId: storeId, // Ad links to the store that created it
        startDate: new Date(promotion.startDate).toISOString(),
        endDate: new Date(promotion.endDate).toISOString(),
        status: 'active',
      });
      toast.success('Success', { description: 'Promotional ad created successfully.' });
      setPromotion({ title: '', description: '', badgeText: '', image: null, startDate: '', endDate: '' });
    } catch (error: any) {
      toast.error('Error Creating Promotion', { description: error.data?.message || 'An unexpected error occurred.' });
    } finally {
      setIsCreatingPromotion(false);
    }
  };

  if (editingDiscount) {
    return <EditDiscountForm discount={editingDiscount} onBack={() => setEditingDiscount(null)} />;
  }

  if (editingPromotion) {
    return <EditPromotionForm promotion={editingPromotion} onBack={() => setEditingPromotion(null)} />;
  }

  const CreateDiscountFormFields = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="font-semibold text-gray-300">Discount Code</Label>
        <Input placeholder="E.g., SUMMER20" value={discountCode} onChange={(e) => setDiscountCode(e.target.value)} className="border-gray-700 bg-gray-800/80 text-gray-200 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Select value={discountType} onValueChange={(value) => setDiscountType(value as DiscountType)}>
          <SelectTrigger className="border-gray-700 bg-gray-800/80 text-gray-200 rounded-xl"><SelectValue placeholder="Discount Type" /></SelectTrigger>
          <SelectContent className="bg-gray-800 border-gray-700 text-gray-200">
            <SelectItem value="percentage">
              <div className="flex items-center">
                <Percent className="h-4 w-4 mr-2" />
                <span>Percentage</span>
              </div>
            </SelectItem>
            <SelectItem value="fixed">
              <div className="flex items-center">
                <DollarSign className="h-4 w-4 mr-2" />
                <span>Fixed Amount</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
        <Input
          className="border-gray-700 bg-gray-800/80 text-gray-200 rounded-xl"
          placeholder="Value"
          type="number"
          value={discountValue}
          onChange={(e) => setDiscountValue(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="start-date" className="font-semibold text-gray-300">Start date</Label>
          <Input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border-gray-700 bg-gray-800/80 text-gray-200 rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end-date" className="font-semibold text-gray-300">Expiration Date</Label>
          <Input id="end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border-gray-700 bg-gray-800/80 text-gray-200 rounded-xl" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="min-order" className="font-semibold text-gray-300">Minimum Order (π)</Label>
          <Input id="min-order" type="number" placeholder="e.g., 100" value={minOrderValue} onChange={(e) => setMinOrderValue(e.target.value)} className="border-gray-700 bg-gray-800/80 text-gray-200 rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="usage-limit" className="font-semibold text-gray-300">Usage Limit (Total)</Label>
          <Input id="usage-limit" type="number" placeholder="e.g., 1000" value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} className="border-gray-700 bg-gray-800/80 text-gray-200 rounded-xl" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="target-users" className="font-semibold text-gray-300">Target Customers</Label>
        <Select value={targetUsers} onValueChange={(value: 'all' | 'new_users_only') => setTargetUsers(value)} >
          <SelectTrigger id="target-users" className="border-gray-700 bg-gray-800/80 text-gray-200 rounded-xl"><SelectValue placeholder="Select target users" /></SelectTrigger>
          <SelectContent className="bg-gray-800 border-gray-700 text-gray-200">
            <SelectItem value="all">
              <div className="flex items-center">
                <Users className="h-4 w-4 mr-2" />
                <span>All Customers</span>
              </div>
            </SelectItem>
            <SelectItem value="new_users_only">
              <div className="flex items-center">
                <Target className="h-4 w-4 mr-2" />
                <span>New Customers Only</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between rounded-xl border border-gray-700/80 p-3 shadow-sm transition-colors hover:bg-gray-800/40">
        <div className="flex items-center gap-3">
          <UserCheck className="h-5 w-5 text-purple-400" />
          <Label htmlFor="limit-per-user" className="cursor-pointer font-semibold text-gray-300">
            Limit to one use per customer
          </Label>
        </div>
        <Switch id="limit-per-user" checked={limitPerUser} onCheckedChange={setLimitPerUser} className="data-[state=checked]:bg-purple-600 data-[state=unchecked]:bg-gray-600" />
      </div>
    </div>
  );

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-gray-700/60 bg-gray-900/60 rounded-2xl">
          <CardHeader>
            <CardTitle className="text-white">Create Discount</CardTitle>
            <CardDescription className="text-gray-400">Create discount codes and loyalty programs</CardDescription>
          </CardHeader>
          <CardContent>
            {CreateDiscountFormFields}
            <Button className="w-full mt-4 bg-gradient-to-r from-purple-600 to-pink-600 font-bold text-white hover:from-purple-700 hover:to-pink-700 rounded-xl" onClick={handleCreateDiscount} disabled={isCreatingDiscount}>
              {isCreatingDiscount && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isCreatingDiscount ? 'Creating...' : 'Create Discount'}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-gray-700/60 bg-gray-900/60 rounded-2xl lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-white">Email Campaign</CardTitle>
            <CardDescription className="text-gray-400">Send promotional emails to customers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="font-semibold text-gray-300">Subject</Label>
              <Input
                className="border-gray-700 bg-gray-800/80 text-gray-200 rounded-xl"
                placeholder="Email subject"
                value={emailCampaign.subject}
                onChange={(e) => setEmailCampaign({ ...emailCampaign, subject: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label className="font-semibold text-gray-300">Content</Label>
              <Textarea
                className="border-gray-700 bg-gray-800/80 text-gray-200 rounded-xl"
                placeholder="Email content"
                value={emailCampaign.content}
                onChange={(e) => setEmailCampaign({ ...emailCampaign, content: e.target.value })}
                rows={10}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 border-purple-500/50 text-purple-400 hover:bg-purple-500/10 hover:text-purple-300 rounded-xl" onClick={() => setIsPreviewOpen(true)} disabled={!emailCampaign.subject && !emailCampaign.content}>
                <Mail className="h-4 w-4 mr-2" />
                Preview
              </Button>
              <Button className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 font-bold text-white hover:from-purple-700 hover:to-pink-700 rounded-xl" onClick={handleSendCampaign} disabled={isSendingCampaign}>
                {isSendingCampaign ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <MessageSquare className="h-4 w-4 mr-2" />
                )}
                {isSendingCampaign ? 'Sending...' : 'Send Campaign'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Card className="border-gray-700/60 bg-gray-900/60 rounded-2xl">
          <CardHeader>
            <CardTitle className="text-white">Create Promotional Ad</CardTitle>
            <CardDescription className="text-gray-400">Create a visual ad to be displayed on the home page.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label className="font-semibold text-gray-300">Ad Image</Label>
                <div className="mt-2 border-2 border-dashed border-gray-600 rounded-xl p-6 text-center">
                  {promotion.image ? (
                    <div className="space-y-2">
                      <img src={URL.createObjectURL(promotion.image)} alt="Preview" className="w-48 aspect-video object-cover rounded-lg mx-auto" />
                      <p className="text-green-400 text-sm">{promotion.image.name}</p>
                      <button type="button" onClick={() => setPromotion({ ...promotion, image: null })} className="text-red-400 hover:text-red-300 text-sm">Remove</button>
                    </div>
                  ) : (
                    <div>
                      <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <input type="file" accept="image/*" onChange={(e) => setPromotion({ ...promotion, image: e.target.files?.[0] || null })} className="hidden" id="promo-image" />
                      <label htmlFor="promo-image" className="text-purple-400 hover:text-purple-300 font-semibold cursor-pointer">Choose Image</label>
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-semibold text-gray-300">Ad Title</Label>
                  <Input placeholder="e.g., 30% Off All Pizzas" value={promotion.title} onChange={(e) => setPromotion({ ...promotion, title: e.target.value })} className="border-gray-700 bg-gray-800/80 text-gray-200 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="font-semibold text-gray-300">Badge Text (Optional)</Label>
                  <Input placeholder="e.g., 30% OFF" value={promotion.badgeText} onChange={(e) => setPromotion({ ...promotion, badgeText: e.target.value })} className="border-gray-700 bg-gray-800/80 text-gray-200 rounded-xl" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="font-semibold text-gray-300">Short Description (Optional)</Label>
                <Input placeholder="e.g., Limited time offer!" value={promotion.description} onChange={(e) => setPromotion({ ...promotion, description: e.target.value })} className="border-gray-700 bg-gray-800/80 text-gray-200 rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-semibold text-gray-300">Start Date</Label>
                  <Input type="date" value={promotion.startDate} onChange={(e) => setPromotion({ ...promotion, startDate: e.target.value })} className="border-gray-700 bg-gray-800/80 text-gray-200 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="font-semibold text-gray-300">End Date</Label>
                  <Input type="date" value={promotion.endDate} onChange={(e) => setPromotion({ ...promotion, endDate: e.target.value })} className="border-gray-700 bg-gray-800/80 text-gray-200 rounded-xl" />
                </div>
              </div>
            </div>
            <Button className="w-full mt-4 bg-gradient-to-r from-purple-600 to-pink-600 font-bold text-white hover:from-purple-700 hover:to-pink-700 rounded-xl" onClick={handleCreatePromotion} disabled={isCreatingPromotion}>
              {isCreatingPromotion ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {isCreatingPromotion ? 'Publishing...' : 'Publish Ad'}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Card className="border-gray-700/60 bg-gray-900/60 rounded-2xl">
          <CardHeader>
            <CardTitle className="text-white">Current Discounts</CardTitle>
            <CardDescription className="text-gray-400">View, edit, or delete your active and expired discounts.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-gray-700 hover:bg-transparent">
                  <TableHead className="text-white">Code</TableHead>
                  <TableHead className="text-white">Value</TableHead>
                  <TableHead className="text-white">Status</TableHead>
                  <TableHead className="text-white">Used</TableHead>
                  <TableHead className="text-right text-white">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {discounts === undefined && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-400 py-8">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                    </TableCell>
                  </TableRow>
                )}
                {discounts && discounts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-400 py-8">
                      No discounts created yet.
                    </TableCell>
                  </TableRow>
                )}
                {discounts?.map((discount) => {
                  const isExpired = discount.endDate ? new Date(discount.endDate) < new Date() : false;
                  const isUsageLimitReached = discount.usageLimit ? discount.timesUsed >= discount.usageLimit : false;
                  const isActive = !isExpired && !isUsageLimitReached;

                  return (
                    <TableRow key={discount._id} className="border-gray-800 hover:bg-gray-800/50">
                      <TableCell className="font-medium text-purple-400">{discount.code}</TableCell>
                      <TableCell className="text-gray-300">
                        {discount.type === 'percentage' ? `${discount.value}%` : `π${discount.value.toFixed(2)}`}
                      </TableCell>
                      <TableCell>
                        <Badge variant={isActive ? "default" : "destructive"} className={`${isActive ? 'bg-green-600/80 text-white' : 'bg-red-600/80 text-white'} rounded-md`}>
                          {isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {discount.timesUsed} / {discount.usageLimit ?? '∞'}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0 text-gray-300 hover:bg-gray-700 data-[state=open]:bg-gray-700">
                              <span className="sr-only">Open menu</span>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-gray-800 border-gray-700 text-gray-200">
                            <DropdownMenuItem onClick={() => setEditingDiscount(discount)} className="focus:bg-gray-700 focus:text-white">
                              <Edit className="mr-2 h-4 w-4" />
                              <span>Edit</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteDiscount(discount)} className="text-red-400 focus:text-red-400 focus:bg-red-500/20">
                              <Trash2 className="mr-2 h-4 w-4" />
                              <span>Delete</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Card className="border-gray-700/60 bg-gray-900/60 rounded-2xl">
          <CardHeader>
            <CardTitle className="text-white">Current Promotions</CardTitle>
            <CardDescription className="text-gray-400">View and manage your active promotional ads.</CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            {/* Mobile View: List of Cards */}
            <div className="sm:hidden space-y-4 p-4"> 
              {promotions?.map((promo: Doc<"promotions"> & { imageUrl?: string | null }) => {
                const now = new Date();
                const startDate = new Date(promo.startDate);
                const endDate = new Date(promo.endDate);
                const isActive = promo.status === 'active' && startDate <= now && endDate >= now;
                return (
                  <div key={promo._id} className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                    <div className="flex items-start gap-4">
                      <img src={promo.imageUrl!} alt={promo.title} className="w-20 h-20 object-cover rounded-lg" />
                      <div className="flex-1">
                        <h4 className="font-semibold text-white">{promo.title}</h4>
                        <p className="text-xs text-gray-400 mt-1">{startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}</p>
                        <Badge variant={isActive ? "default" : "destructive"} className={`mt-2 ${isActive ? 'bg-green-600/80 text-white' : 'bg-gray-600/80 text-white'} rounded-md`}>
                          {isActive ? 'Live' : (endDate < now ? 'Expired' : 'Scheduled')}
                        </Badge>
                      </div>
                      <div className="flex-shrink-0">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0 text-gray-300 hover:bg-gray-700 data-[state=open]:bg-gray-700">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-gray-800 border-gray-700 text-gray-200">
                            <DropdownMenuItem onClick={() => setEditingPromotion(promo)} className="focus:bg-gray-700 focus:text-white"><Edit className="mr-2 h-4 w-4" /><span>Edit</span></DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeletePromotion(promo)} className="text-red-400 focus:text-red-400 focus:bg-red-500/20"><Trash2 className="mr-2 h-4 w-4" /><span>Delete</span></DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop View: Table */}
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700 hover:bg-transparent">
                    <TableHead className="text-white">Ad</TableHead>
                    <TableHead className="text-white">Status</TableHead>
                    <TableHead className="text-white">Dates</TableHead>
                    <TableHead className="text-right text-white">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {promotions === undefined && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-gray-400 py-8">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                      </TableCell>
                    </TableRow>
                  )}
                  {promotions && promotions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-gray-400 py-8">
                        No promotional ads created yet.
                      </TableCell>
                    </TableRow>
                  )} 
                  {promotions?.map((promo: Doc<"promotions"> & { imageUrl?: string | null }) => {
                    const now = new Date();
                    const startDate = new Date(promo.startDate);
                    const endDate = new Date(promo.endDate);
                    const isActive = promo.status === 'active' && startDate <= now && endDate >= now;

                    return (
                      <TableRow key={promo._id} className="border-gray-800 hover:bg-gray-800/50">
                        <TableCell className="font-medium text-purple-400 flex items-center gap-3">
                          <img src={promo.imageUrl!} alt={promo.title} className="w-16 h-9 object-cover rounded-md" />
                          <span>{promo.title}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={isActive ? "default" : "destructive"} className={`${isActive ? 'bg-green-600/80 text-white' : 'bg-gray-600/80 text-white'} rounded-md`}>
                            {isActive ? 'Live' : (endDate < now ? 'Expired' : 'Scheduled')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-300 text-xs">
                          {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0 text-gray-300 hover:bg-gray-700 data-[state=open]:bg-gray-700">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-gray-800 border-gray-700 text-gray-200">
                              <DropdownMenuItem onClick={() => setEditingPromotion(promo)} className="focus:bg-gray-700 focus:text-white"><Edit className="mr-2 h-4 w-4" /><span>Edit</span></DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDeletePromotion(promo)} className="text-red-400 focus:text-red-400 focus:bg-red-500/20"><Trash2 className="mr-2 h-4 w-4" /><span>Delete</span></DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isConfirmDeleteDialogOpen} onOpenChange={setIsConfirmDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px] bg-gray-900/90 border-gray-700/60 text-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <TriangleAlert className="h-6 w-6 text-yellow-400" />
              <span>Confirm Deletion</span>
            </DialogTitle>
            <DialogDescription className="text-gray-400 pt-2 pl-8">
              Are you sure you want to delete the discount "<strong>{discountToDelete?.code}</strong>"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 sm:justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsConfirmDeleteDialogOpen(false)} className="text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition-colors rounded-xl">Cancel</Button>
            <Button variant="destructive" onClick={confirmDeleteDiscount} className="transition-transform hover:scale-105 rounded-xl">Delete Discount</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isConfirmDeletePromoDialogOpen} onOpenChange={setIsConfirmDeletePromoDialogOpen}>
        <DialogContent className="sm:max-w-[425px] bg-gray-900/90 border-gray-700/60 text-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <TriangleAlert className="h-6 w-6 text-yellow-400" />
              <span>Confirm Deletion</span>
            </DialogTitle>
            <DialogDescription className="text-gray-400 pt-2 pl-8">
              Are you sure you want to delete the promotion "<strong>{promotionToDelete?.title}</strong>"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 sm:justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsConfirmDeletePromoDialogOpen(false)} className="text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition-colors rounded-xl">Cancel</Button>
            <Button variant="destructive" onClick={confirmDeletePromotion} className="transition-transform hover:scale-105 rounded-xl">Delete Promotion</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="sm:max-w-2xl bg-gray-900/90 border-gray-700/60 text-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Email Preview</DialogTitle>
            <DialogDescription className="text-gray-400">This is how your email will look to your followers.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 p-4 border border-gray-700 rounded-lg bg-gray-800/50">
            <div className="mb-4">
              <p className="text-sm text-gray-400">Subject:</p>
              <p className="font-semibold text-white">{emailCampaign.subject || "(No Subject)"}</p>
            </div>
            <div className="border-t border-gray-700 pt-4">
              <p className="text-sm text-gray-400">Content:</p>
              <p className="whitespace-pre-wrap text-white">{emailCampaign.content || "(No Content)"}</p>
            </div>
          </div>
          <DialogFooter className="mt-4"><Button onClick={() => setIsPreviewOpen(false)} className="rounded-xl">Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}