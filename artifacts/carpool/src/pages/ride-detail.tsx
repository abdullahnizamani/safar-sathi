import { useParams, Link } from "wouter";
import { useGetRide, useGetMe, useCreateRideRequest, getGetRideQueryKey, getListRideRequestsQueryKey, getListMyRequestsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { getStatusColor, getGenderPreferenceColor } from "@/components/ride-card";
import { formatDateTime, formatPKR } from "@/lib/format";
import { MapPin, Clock, Users, ArrowRight, User, GraduationCap, ArrowLeft, Star } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { RouteMap } from "@/components/route-map";

export default function RideDetail() {
  const { id } = useParams();
  const rideId = Number(id);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: user } = useGetMe();
  const { data: ride, isLoading, error } = useGetRide(rideId, {
    query: { enabled: !!rideId, queryKey: getGetRideQueryKey(rideId) },
  });

  const createRequest = useCreateRideRequest();

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-8 w-24 mb-6" />
        <Skeleton className="h-[400px] w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !ride) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-destructive">Ride not found</h2>
        <p className="text-muted-foreground mt-2 mb-6">This ride may have been cancelled or deleted.</p>
        <Button asChild><Link href="/">Back to Rides</Link></Button>
      </div>
    );
  }

  const isDriver = user?.id === ride.driver_id;
  const isAvailable = ride.status === "OPEN" && ride.available_seats > 0;

  const hasCoords =
    ride.origin_lat != null &&
    ride.origin_lng != null &&
    ride.dest_lat != null &&
    ride.dest_lng != null;

  const handleRequestSeat = () => {
    createRequest.mutate(
      { data: { ride_id: rideId } },
      {
        onSuccess: () => {
          toast({ title: "Request Sent!", description: "The driver has been notified of your request." });
          queryClient.invalidateQueries({ queryKey: getGetRideQueryKey(rideId) });
          queryClient.invalidateQueries({ queryKey: getListMyRequestsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListRideRequestsQueryKey(rideId) });
        },
        onError: (err: any) => {
          toast({ title: "Request Failed", description: err?.message || "Could not send request.", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-6 text-muted-foreground -ml-2">
          <Link href="/"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Rides</Link>
        </Button>

        <div className="bg-card border rounded-3xl overflow-hidden shadow-sm">
          {/* Route header */}
          <div className="bg-muted/30 p-8 border-b">
            <div className="flex justify-between items-start gap-4 mb-8">
              <Badge variant="outline" className={`px-3 py-1 text-xs font-bold shadow-none ${getStatusColor(ride.status)} border-0`}>
                {ride.status}
              </Badge>
              <div className="text-3xl font-extrabold text-primary">{formatPKR(ride.fare)}</div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center gap-6 text-2xl font-bold text-foreground">
              <div className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-muted-foreground mb-1 uppercase tracking-wider">From</span>
                <span className="truncate block" data-testid="text-origin">{ride.origin}</span>
              </div>
              <div className="hidden md:flex shrink-0 w-12 h-12 rounded-full bg-background border items-center justify-center">
                <ArrowRight className="w-5 h-5 text-primary" />
              </div>
              <div className="md:hidden">
                <ArrowRight className="w-5 h-5 text-muted-foreground rotate-90" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-muted-foreground mb-1 uppercase tracking-wider">To</span>
                <span className="truncate block" data-testid="text-destination">{ride.destination}</span>
              </div>
            </div>
          </div>

          {/* Mapbox Route Map — shown when coordinates are available */}
          {hasCoords && (
            <div className="px-0 border-b">
              <RouteMap
                originLat={ride.origin_lat!}
                originLng={ride.origin_lng!}
                destLat={ride.dest_lat!}
                destLng={ride.dest_lng!}
                originLabel={ride.origin}
                destLabel={ride.destination}
                className="w-full h-72"
              />
            </div>
          )}

          <div className="p-8">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Departure Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
              <div>
                <span className="block text-sm font-medium text-muted-foreground mb-1">Time</span>
                <span className="font-semibold text-lg">{formatDateTime(ride.departure_time)}</span>
              </div>
              <div>
                <span className="block text-sm font-medium text-muted-foreground mb-1">Seats Available</span>
                <span className="font-semibold text-lg">{ride.available_seats} remaining</span>
              </div>
              <div>
                <span className="block text-sm font-medium text-muted-foreground mb-1">Transport</span>
                <span className="font-semibold text-lg">{ride.transport_type}</span>
              </div>
            </div>

            <Separator className="my-8" />

            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Driver Profile
            </h3>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-bold border border-primary/20">
                  {ride.driver_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-bold text-lg" data-testid="text-driver-name">{ride.driver_name}</div>
                  {ride.driver_university && (
                    <div className="flex items-center gap-1 text-muted-foreground text-sm">
                      <GraduationCap className="w-4 h-4" />
                      {ride.driver_university}
                    </div>
                  )}
                  {ride.driver_avg_rating != null && (
                    <div className="flex items-center gap-1 mt-1" data-testid="driver-avg-rating">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3.5 h-3.5 ${i < Math.round(ride.driver_avg_rating!) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                        />
                      ))}
                      <span className="text-xs font-semibold text-amber-600 ml-1">
                        {ride.driver_avg_rating.toFixed(1)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Separator className="my-8" />

            <div className="bg-muted/50 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border">
              <div>
                <div className="font-medium mb-1">Gender Preference</div>
                <Badge variant="outline" className={`text-xs uppercase tracking-wider font-bold ${getGenderPreferenceColor(ride.gender_preference)}`}>
                  {ride.gender_preference === "ANY" ? "ANY GENDER" : `${ride.gender_preference} ONLY`}
                </Badge>
              </div>

              {!isDriver && (
                <div className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    className="w-full font-bold shadow-md hover:shadow-lg transition-all"
                    disabled={!isAvailable || createRequest.isPending}
                    onClick={handleRequestSeat}
                    data-testid="button-request-seat"
                  >
                    {createRequest.isPending ? "Sending..." :
                      !isAvailable ? "Ride Unavailable" :
                        "Request a Seat"}
                  </Button>
                </div>
              )}

              {isDriver && (
                <div className="w-full sm:w-auto">
                  <Button size="lg" variant="secondary" asChild className="w-full font-bold shadow-sm">
                    <Link href="/my-rides">Manage Requests</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
