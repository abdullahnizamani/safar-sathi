import { useState } from "react";
import {
  useListMyRequests,
  useCreateReview,
  useUpdateRideRequest,
  getListMyRequestsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatDateTime, formatPKR } from "@/lib/format";
import { getStatusColor } from "@/components/ride-card";
import { Clock, ArrowRight, User, Map, Star, Phone, Users, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

function InteractiveStars({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className="focus:outline-none transition-transform hover:scale-110"
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(star)}
        >
          <Star
            className={cn(
              "w-8 h-8 transition-colors",
              star <= (hovered || value)
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/30"
            )}
          />
        </button>
      ))}
    </div>
  );
}

interface ReviewTarget {
  rideId: number;
  driverId: number;
  driverName: string;
  rideLabel: string;
}

export default function MyRequests() {
  const { data: requests, isLoading } = useListMyRequests({
    query: { queryKey: getListMyRequestsQueryKey() },
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createReview = useCreateReview();
  const updateRequest = useUpdateRideRequest();

  const [reviewedRideIds, setReviewedRideIds] = useState<Set<number>>(new Set());
  const [target, setTarget] = useState<ReviewTarget | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  const handleCancelRequest = (requestId: number) => {
    if (confirm("Are you sure you want to cancel this request?")) {
      updateRequest.mutate(
        { id: requestId, data: { status: "CANCELLED" } },
        {
          onSuccess: () => {
            toast({ title: "Request Cancelled", description: "Your ride request has been cancelled." });
            queryClient.invalidateQueries({ queryKey: getListMyRequestsQueryKey() });
          },
          onError: (err: any) => {
            toast({
              title: "Cancellation Failed",
              description: err?.message || "Could not cancel request.",
              variant: "destructive",
            });
          },
        }
      );
    }
  };

  const openReview = (t: ReviewTarget) => {
    setTarget(t);
    setRating(0);
    setComment("");
  };

  const closeReview = () => {
    setTarget(null);
    setRating(0);
    setComment("");
  };

  const submitReview = () => {
    if (!target || rating === 0) return;
    createReview.mutate(
      {
        data: {
          driver_id: target.driverId,
          ride_id: target.rideId,
          rating,
          comment: comment.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          setReviewedRideIds((prev) => new Set(prev).add(target.rideId));
          queryClient.invalidateQueries({ queryKey: getListMyRequestsQueryKey() });
          toast({
            title: "Review submitted!",
            description: `You rated ${target.driverName} ${rating} star${rating !== 1 ? "s" : ""}.`,
          });
          closeReview();
        },
        onError: (err: any) => {
          toast({
            title: "Could not submit review",
            description: err?.message || "An error occurred.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const activeRequests = requests?.filter((r) => r.status === "PENDING" || r.status === "ACCEPTED") ?? [];
  const pastRequests = requests?.filter((r) => r.status === "CANCELLED" || r.status === "REJECTED") ?? [];

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">My Ride Requests</h1>
        <p className="text-muted-foreground mt-2">
          Track the status of rides you've requested to join.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      ) : !requests || requests.length === 0 ? (
        <div className="text-center py-20 bg-card border border-dashed rounded-2xl shadow-sm">
          <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Map className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-bold mb-2">No requests yet</h3>
          <p className="text-muted-foreground max-w-sm mx-auto mb-6">
            You haven't requested any rides. Browse the feed to find a commute.
          </p>
          <Button asChild>
            <Link href="/">Find a Ride</Link>
          </Button>
        </div>
      ) : (
        <Tabs defaultValue="active" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px] bg-muted/60 p-1 rounded-xl">
            <TabsTrigger value="active" className="font-semibold rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Active Bookings ({activeRequests.length})
            </TabsTrigger>
            <TabsTrigger value="past" className="font-semibold rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Past Bookings ({pastRequests.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4 outline-none">
            {activeRequests.length === 0 ? (
              <div className="text-center py-12 bg-card border border-dashed rounded-2xl text-muted-foreground text-sm font-medium animate-in fade-in duration-300">
                No active bookings or pending requests.
              </div>
            ) : (
              <div className="grid gap-4">
                {activeRequests.map((req) => {
                  const isAccepted = req.status === "ACCEPTED";
                  const alreadyReviewed = reviewedRideIds.has(req.ride_id);

                  return (
                    <Card
                      key={req.id}
                      className="overflow-hidden border shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className={`h-1.5 w-full bg-blue-400 ${isAccepted ? "bg-green-500" : ""}`} />
                      <CardContent className="p-6">
                        <div className="flex flex-col md:flex-row justify-between gap-6">
                          {req.ride && (
                            <div className="flex-1 space-y-4">
                              <div className="flex items-center gap-2 font-bold text-lg flex-wrap">
                                <span>{req.ride.origin}</span>
                                <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                                <span>{req.ride.destination}</span>
                              </div>

                              <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-muted-foreground">
                                <span className="flex items-center gap-1.5 bg-muted px-2.5 py-1 rounded-md">
                                  <Clock className="w-4 h-4" />{" "}
                                  {formatDateTime(req.ride.departure_time)}
                                </span>
                                <span className="flex items-center gap-1.5 bg-muted px-2.5 py-1 rounded-md">
                                  <User className="w-4 h-4" /> {req.ride.driver_name}
                                </span>
                                <span className="flex items-center gap-1.5 bg-muted px-2.5 py-1 rounded-md">
                                  <Users className="w-4 h-4" /> {req.requested_seats} seat{req.requested_seats !== 1 ? "s" : ""}
                                </span>
                                <span className="font-bold text-primary px-2.5 py-1">
                                  {formatPKR(req.ride.fare)}
                                </span>
                              </div>

                              {isAccepted && req.driver_phone && (
                                <a
                                  href={`tel:${req.driver_phone}`}
                                  className="inline-flex items-center gap-2 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 rounded-lg px-4 py-2.5 text-sm font-semibold hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors w-fit"
                                >
                                  <Phone className="w-4 h-4" />
                                  Call driver: {req.driver_phone}
                                </a>
                              )}
                            </div>
                          )}

                          <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-4 border-t md:border-t-0 md:border-l pt-4 md:pt-0 md:pl-6 min-w-[120px]">
                            <div className="text-center md:text-right">
                              <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">
                                Status
                              </div>
                              <Badge
                                variant="outline"
                                className={`text-sm px-3 py-1 font-bold border-0 shadow-none ${getStatusColor(req.status)}`}
                              >
                                {req.status}
                              </Badge>
                            </div>

                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs text-destructive border-destructive/20 hover:bg-destructive/10 hover:text-destructive w-full md:w-auto"
                              onClick={() => handleCancelRequest(req.id)}
                              disabled={updateRequest.isPending || req.ride?.status === "COMPLETED" || req.ride?.status === "CANCELLED"}
                            >
                              <X className="w-3.5 h-3.5 mr-1" /> Cancel
                            </Button>

                            {isAccepted && req.ride && (
                              <Button
                                size="sm"
                                variant={alreadyReviewed ? "outline" : "default"}
                                disabled={alreadyReviewed}
                                onClick={() =>
                                  openReview({
                                    rideId: req.ride_id,
                                    driverId: req.ride!.driver_id,
                                    driverName: req.ride!.driver_name,
                                    rideLabel: `${req.ride!.origin} → ${req.ride!.destination}`,
                                  })
                                }
                                className="shrink-0"
                              >
                                {alreadyReviewed ? (
                                  <>
                                    <Star className="w-3.5 h-3.5 mr-1 fill-amber-400 text-amber-400" />
                                    Reviewed
                                  </>
                                ) : (
                                  <>
                                    <Star className="w-3.5 h-3.5 mr-1" />
                                    Review Driver
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="past" className="space-y-4 outline-none">
            {pastRequests.length === 0 ? (
              <div className="text-center py-12 bg-card border border-dashed rounded-2xl text-muted-foreground text-sm font-medium animate-in fade-in duration-300">
                No past or cancelled bookings.
              </div>
            ) : (
              <div className="grid gap-4">
                {pastRequests.map((req) => {
                  const isAccepted = req.status === "ACCEPTED";
                  const alreadyReviewed = reviewedRideIds.has(req.ride_id);

                  return (
                    <Card
                      key={req.id}
                      className="overflow-hidden border shadow-sm opacity-80"
                    >
                      <div className={`h-1.5 w-full ${req.status === "REJECTED" ? "bg-red-500" : "bg-muted"}`} />
                      <CardContent className="p-6">
                        <div className="flex flex-col md:flex-row justify-between gap-6">
                          {req.ride && (
                            <div className="flex-1 space-y-4">
                              <div className="flex items-center gap-2 font-bold text-lg flex-wrap">
                                <span>{req.ride.origin}</span>
                                <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                                <span>{req.ride.destination}</span>
                              </div>

                              <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-muted-foreground">
                                <span className="flex items-center gap-1.5 bg-muted px-2.5 py-1 rounded-md">
                                  <Clock className="w-4 h-4" />{" "}
                                  {formatDateTime(req.ride.departure_time)}
                                </span>
                                <span className="flex items-center gap-1.5 bg-muted px-2.5 py-1 rounded-md">
                                  <User className="w-4 h-4" /> {req.ride.driver_name}
                                </span>
                                <span className="flex items-center gap-1.5 bg-muted px-2.5 py-1 rounded-md">
                                  <Users className="w-4 h-4" /> {req.requested_seats} seat{req.requested_seats !== 1 ? "s" : ""}
                                </span>
                                <span className="font-bold text-primary px-2.5 py-1">
                                  {formatPKR(req.ride.fare)}
                                </span>
                              </div>
                            </div>
                          )}

                          <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-4 border-t md:border-t-0 md:border-l pt-4 md:pt-0 md:pl-6 min-w-[120px]">
                            <div className="text-center md:text-right">
                              <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">
                                Status
                              </div>
                              <Badge
                                variant="outline"
                                className={`text-sm px-3 py-1 font-bold border-0 shadow-none ${getStatusColor(req.status)}`}
                              >
                                {req.status}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Review modal */}
      <Dialog open={!!target} onOpenChange={(open) => !open && closeReview()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Rate your driver</DialogTitle>
            <DialogDescription>
              How was your ride with{" "}
              <span className="font-semibold text-foreground">
                {target?.driverName}
              </span>
              ?
              {target && (
                <span className="block text-xs mt-0.5 text-muted-foreground">
                  {target.rideLabel}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="flex flex-col items-center gap-3">
              <InteractiveStars value={rating} onChange={setRating} />
              <span className="text-sm text-muted-foreground">
                {rating === 0
                  ? "Tap a star to rate"
                  : rating === 1
                  ? "Poor"
                  : rating === 2
                  ? "Fair"
                  : rating === 3
                  ? "Good"
                  : rating === 4
                  ? "Very Good"
                  : "Excellent!"}
              </span>
            </div>

            <Textarea
              placeholder="Share your experience (optional)..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={closeReview}>
              Cancel
            </Button>
            <Button
              onClick={submitReview}
              disabled={rating === 0 || createReview.isPending}
            >
              {createReview.isPending ? "Submitting..." : "Submit Review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
