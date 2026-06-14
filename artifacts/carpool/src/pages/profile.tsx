import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  useGetMe,
  useGetUserReviews,
  useUpdateProfile,
  useDeleteAccount,
  getGetMeQueryKey,
  getGetUserReviewsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { LogOut, Star, MessageSquare, GraduationCap, Phone, Mail, User, Camera, Check, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// Preset DiceBear avatar URLs — deterministic SVG avatars, no account needed
const PRESET_AVATARS = [
  { id: "campus-1", url: "https://api.dicebear.com/9.x/thumbs/svg?seed=campus1&backgroundColor=b6e3f4" },
  { id: "campus-2", url: "https://api.dicebear.com/9.x/thumbs/svg?seed=campus2&backgroundColor=c0aede" },
  { id: "campus-3", url: "https://api.dicebear.com/9.x/thumbs/svg?seed=campus3&backgroundColor=ffdfbf" },
  { id: "campus-4", url: "https://api.dicebear.com/9.x/thumbs/svg?seed=campus4&backgroundColor=d1f4d8" },
  { id: "campus-5", url: "https://api.dicebear.com/9.x/thumbs/svg?seed=campus5&backgroundColor=ffd5dc" },
  { id: "campus-6", url: "https://api.dicebear.com/9.x/thumbs/svg?seed=campus6&backgroundColor=ffe4b5" },
];

function StarRating({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <div className="flex items-center gap-0.5" data-testid="star-rating">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={`w-4 h-4 ${
            i < Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
          }`}
        />
      ))}
    </div>
  );
}

export default function Profile() {
  const { logout, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: user, isLoading: userLoading } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), enabled: isAuthenticated },
  });

  const { data: reviewData, isLoading: reviewLoading } = useGetUserReviews(
    user?.id ?? 0,
    { query: { queryKey: getGetUserReviewsQueryKey(user?.id ?? 0), enabled: !!user?.id } }
  );

  const updateProfile = useUpdateProfile();
  const deleteAccount = useDeleteAccount();

  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [university, setUniversity] = useState("");
  const [closeAccountDialogOpen, setCloseAccountDialogOpen] = useState(false);

  useEffect(() => {
    if (user) {
      setEmail(user.email);
      setPhone(user.phone_number);
      setUniversity(user.university);
    }
  }, [user]);

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  const handleCloseAccount = () => {
    deleteAccount.mutate(undefined, {
      onSuccess: () => {
        toast({
          title: "Account closed successfully",
          description: "Your SafarSathi account has been deleted.",
        });
        logout();
        setLocation("/login");
      },
      onError: (err: any) => {
        const errMsg = err?.response?.data?.error || err?.message || "Failed to close account";
        toast({
          title: "Error",
          description: errMsg,
          variant: "destructive",
        });
      },
    });
  };

  const initials = user?.username ? user.username.slice(0, 2).toUpperCase() : "?";

  const genderLabel = (g: string) => {
    if (g === "M") return "Male";
    if (g === "F") return "Female";
    return "Other";
  };

  const openAvatarDialog = () => {
    setPendingUrl(user?.avatar_url ?? null);
    setAvatarDialogOpen(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("avatar", file);

    try {
      const token = localStorage.getItem("carpool_token");
      const response = await fetch("/api/users/avatar", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload avatar");
      }

      const data = await response.json();
      setPendingUrl(data.avatar_url);
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      toast({ title: "Avatar uploaded successfully!" });
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Something went wrong",
        variant: "destructive",
      });
    }
  };

  const saveAvatar = () => {
    const url = pendingUrl?.trim() || null;
    updateProfile.mutate(
      { data: { avatar_url: url } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          toast({ title: "Avatar updated!" });
          setAvatarDialogOpen(false);
        },
        onError: () => {
          toast({ title: "Could not update avatar", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h1 className="text-3xl font-extrabold tracking-tight">My Profile</h1>

      {/* Identity card */}
      <Card className="bg-card/50 backdrop-blur-md border border-border/80 shadow-md" data-testid="profile-card">
        <CardContent className="pt-6">
          {userLoading ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Skeleton className="w-16 h-16 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="w-40 h-5" />
                  <Skeleton className="w-24 h-4" />
                </div>
              </div>
            </div>
          ) : user ? (
            <div className="space-y-5">
              <div className="flex items-center gap-5">
                {/* Clickable avatar with camera edit icon */}
                <button
                  type="button"
                  className="relative group shrink-0"
                  onClick={openAvatarDialog}
                  aria-label="Change avatar"
                >
                  <Avatar className="w-16 h-16 text-xl font-bold border-2 border-primary/20">
                    {user.avatar_url ? (
                      <AvatarImage src={user.avatar_url} alt={user.username} />
                    ) : null}
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="w-5 h-5 text-white" />
                  </span>
                </button>

                <div>
                  <div className="text-xl font-extrabold tracking-tight" data-testid="text-username">
                    {user.username}
                  </div>
                  {reviewData &&
                  reviewData.avg_rating !== null &&
                  reviewData.avg_rating !== undefined ? (
                    <div className="flex items-center gap-2 mt-1">
                      <StarRating rating={reviewData.avg_rating} />
                      <span className="text-sm font-semibold text-amber-600">
                        {reviewData.avg_rating.toFixed(1)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({reviewData.review_count} review
                        {reviewData.review_count !== 1 ? "s" : ""})
                      </span>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground mt-1">No reviews yet</div>
                  )}
                  <button
                    onClick={openAvatarDialog}
                    className="text-xs text-primary/70 hover:text-primary mt-1 underline-offset-2 hover:underline transition-colors"
                  >
                    Change avatar
                  </button>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Mail className="w-4 h-4 shrink-0 text-primary/70" />
                  <span data-testid="text-email">{user.email}</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Phone className="w-4 h-4 shrink-0 text-primary/70" />
                  <span data-testid="text-phone">{user.phone_number}</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <GraduationCap className="w-4 h-4 shrink-0 text-primary/70" />
                  <span data-testid="text-university">{user.university}</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <User className="w-4 h-4 shrink-0 text-primary/70" />
                  <span data-testid="text-gender">{genderLabel(user.gender)}</span>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Reviews section */}
      <Card className="bg-card/50 backdrop-blur-md border border-border/80 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="w-5 h-5 text-primary" />
            Reviews Received
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reviewLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="w-32 h-4" />
                  <Skeleton className="w-full h-10" />
                </div>
              ))}
            </div>
          ) : reviewData && reviewData.reviews.length > 0 ? (
            <div className="space-y-4" data-testid="reviews-list">
              {reviewData.reviews.map((review) => (
                <div
                  key={review.id}
                  className="border rounded-lg p-4 space-y-2"
                  data-testid={`review-item-${review.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="w-7 h-7">
                        <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                          {review.reviewer_name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span
                        className="text-sm font-semibold"
                        data-testid={`text-reviewer-${review.id}`}
                      >
                        {review.reviewer_name}
                      </span>
                    </div>
                    <StarRating rating={review.rating} />
                  </div>
                  {review.comment && (
                    <p
                      className="text-sm text-muted-foreground leading-relaxed"
                      data-testid={`text-comment-${review.id}`}
                    >
                      {review.comment}
                    </p>
                  )}
                  <div className="text-[11px] text-muted-foreground/60">
                    {new Date(review.created_at).toLocaleDateString("en-PK", {
                      dateStyle: "medium",
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              className="text-center py-8 text-muted-foreground"
              data-testid="no-reviews"
            >
              <Star className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="font-medium">No reviews yet</p>
              <p className="text-sm mt-1">
                Reviews appear here once passengers rate your rides.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Profile Details card */}
      <Card className="bg-card/50 backdrop-blur-md border border-border/80 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="w-5 h-5 text-primary" />
            Edit Profile Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!email.trim() || !phone.trim() || !university.trim()) {
                toast({
                  title: "Validation Error",
                  description: "All fields are required",
                  variant: "destructive",
                });
                return;
              }
              updateProfile.mutate(
                {
                  data: {
                    email: email.trim(),
                    phone_number: phone.trim(),
                    university: university.trim(),
                  },
                },
                {
                  onSuccess: () => {
                    queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
                    toast({ title: "Profile updated successfully!" });
                  },
                  onError: (err: any) => {
                    const errMsg =
                      err?.response?.data?.error || err?.message || "Could not update profile";
                    toast({
                      title: "Update failed",
                      description: errMsg,
                      variant: "destructive",
                    });
                  },
                }
              );
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <label htmlFor="edit-email" className="text-sm font-semibold text-muted-foreground">
                Email Address
              </label>
              <Input
                id="edit-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="edit-phone" className="text-sm font-semibold text-muted-foreground">
                Phone Number
              </label>
              <Input
                id="edit-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +92 300 1234567"
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="edit-university" className="text-sm font-semibold text-muted-foreground">
                Institute / University
              </label>
              <Input
                id="edit-university"
                type="text"
                value={university}
                onChange={(e) => setUniversity(e.target.value)}
                placeholder="FAST National University"
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full font-semibold btn-gradient"
              disabled={updateProfile.isPending}
            >
              {updateProfile.isPending ? "Saving changes..." : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border border-destructive/30 bg-destructive/5 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg text-destructive">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Permanently close your SafarSathi account. This action is irreversible and will delete all your ride postings, ride requests, and reviews.
          </p>
          <Button
            variant="destructive"
            className="w-full font-semibold bg-destructive hover:bg-destructive/90"
            onClick={() => setCloseAccountDialogOpen(true)}
            data-testid="button-close-account"
          >
            Close My Account
          </Button>
        </CardContent>
      </Card>

      {/* Logout */}
      <Button
        variant="destructive"
        className="w-full font-semibold"
        onClick={handleLogout}
        data-testid="button-logout"
      >
        <LogOut className="w-4 h-4 mr-2" />
        Sign Out
      </Button>

      {/* Avatar picker dialog */}
      <Dialog open={avatarDialogOpen} onOpenChange={setAvatarDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Choose your avatar</DialogTitle>
            <DialogDescription>
              Pick a preset or paste your own image URL.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Preset grid */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Preset avatars
              </p>
              <div className="grid grid-cols-6 gap-2">
                {PRESET_AVATARS.map((preset) => {
                  const isSelected = pendingUrl === preset.url;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setPendingUrl(preset.url)}
                      className={cn(
                        "relative rounded-full overflow-hidden w-12 h-12 border-2 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                        isSelected ? "border-primary shadow-md" : "border-transparent"
                      )}
                    >
                      <img
                        src={preset.url}
                        alt={preset.id}
                        className="w-full h-full"
                      />
                      {isSelected && (
                        <span className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <Check className="w-4 h-4 text-primary" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* File Upload input */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Or upload an image file
              </p>
              <Input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="text-sm cursor-pointer"
              />
              {pendingUrl && !PRESET_AVATARS.some((p) => p.url === pendingUrl) && (
                <div className="flex items-center gap-3 mt-2">
                  <img
                    src={pendingUrl}
                    alt="Preview"
                    className="w-10 h-10 rounded-full border object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                    {pendingUrl}
                  </span>
                </div>
              )}
            </div>

            {/* Clear option */}
            {(pendingUrl || user?.avatar_url) && (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                onClick={() => {
                  setPendingUrl(null);
                }}
              >
                Remove avatar (use initials)
              </button>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setAvatarDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveAvatar} disabled={updateProfile.isPending}>
              {updateProfile.isPending ? "Saving..." : "Save Avatar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Account Confirmation dialog */}
      <Dialog open={closeAccountDialogOpen} onOpenChange={setCloseAccountDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Are you absolutely sure?
            </DialogTitle>
            <div className="space-y-2 pt-2 text-sm text-muted-foreground">
              <p>
                This will permanently delete your SafarSathi account (<strong>{user?.username}</strong>) and all associated data.
              </p>
              <p className="text-destructive font-semibold">
                This action cannot be undone.
              </p>
            </div>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              variant="ghost"
              onClick={() => setCloseAccountDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleCloseAccount}
              disabled={deleteAccount.isPending}
            >
              {deleteAccount.isPending ? "Closing account..." : "Permanently Close Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
