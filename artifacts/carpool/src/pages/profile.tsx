import { useLocation } from "wouter";
import { useGetMe, useGetUserReviews } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { LogOut, Star, MessageSquare, GraduationCap, Phone, Mail, User } from "lucide-react";

function StarRating({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <div className="flex items-center gap-0.5" data-testid="star-rating">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={`w-4 h-4 ${i < Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

export default function Profile() {
  const { logout, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  const { data: user, isLoading: userLoading } = useGetMe({
    query: { enabled: isAuthenticated },
  });

  const { data: reviewData, isLoading: reviewLoading } = useGetUserReviews(
    user?.id ?? 0,
    { query: { enabled: !!user?.id } }
  );

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : "?";

  const genderLabel = (g: string) => {
    if (g === "M") return "Male";
    if (g === "F") return "Female";
    return "Other";
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h1 className="text-3xl font-extrabold tracking-tight">My Profile</h1>

      {/* Identity card */}
      <Card className="border shadow-sm" data-testid="profile-card">
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
                <Avatar className="w-16 h-16 text-xl font-bold border-2 border-primary/20">
                  <AvatarFallback className="bg-primary/10 text-primary">{initials}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-xl font-extrabold tracking-tight" data-testid="text-username">
                    {user.username}
                  </div>
                  {reviewData && reviewData.avg_rating !== null && reviewData.avg_rating !== undefined ? (
                    <div className="flex items-center gap-2 mt-1">
                      <StarRating rating={reviewData.avg_rating} />
                      <span className="text-sm font-semibold text-amber-600">
                        {reviewData.avg_rating.toFixed(1)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({reviewData.review_count} review{reviewData.review_count !== 1 ? "s" : ""})
                      </span>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground mt-1">No reviews yet</div>
                  )}
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
      <Card className="border shadow-sm">
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
                <div key={review.id} className="border rounded-lg p-4 space-y-2" data-testid={`review-item-${review.id}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="w-7 h-7">
                        <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                          {review.reviewer_name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-semibold" data-testid={`text-reviewer-${review.id}`}>
                        {review.reviewer_name}
                      </span>
                    </div>
                    <StarRating rating={review.rating} />
                  </div>
                  {review.comment && (
                    <p className="text-sm text-muted-foreground leading-relaxed" data-testid={`text-comment-${review.id}`}>
                      {review.comment}
                    </p>
                  )}
                  <div className="text-[11px] text-muted-foreground/60">
                    {new Date(review.created_at).toLocaleDateString("en-PK", { dateStyle: "medium" })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground" data-testid="no-reviews">
              <Star className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="font-medium">No reviews yet</p>
              <p className="text-sm mt-1">Reviews appear here once passengers rate your rides.</p>
            </div>
          )}
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
    </div>
  );
}
