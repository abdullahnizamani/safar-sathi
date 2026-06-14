import { useListMyRides, useListRideRequests, useUpdateRideRequest, useUpdateRide, getListMyRidesQueryKey, getListRideRequestsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime, formatPKR } from "@/lib/format";
import { getStatusColor } from "@/components/ride-card";
import { Check, X, Users, ArrowRight, User, Clock, Phone } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Link } from "wouter";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

function RideRequests({ rideId, availableSeats, rideStatus }: { rideId: number; availableSeats: number; rideStatus?: string }) {
  const { data: requests, isLoading } = useListRideRequests(rideId, {
    query: { enabled: !!rideId, queryKey: getListRideRequestsQueryKey(rideId) },
  });
  const updateRequest = useUpdateRideRequest();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  if (isLoading) return <div className="p-4"><Skeleton className="h-20 w-full" /></div>;
  if (!requests || requests.length === 0)
    return <div className="p-6 text-center text-muted-foreground text-sm">No requests for this ride yet.</div>;

  const handleUpdateStatus = (requestId: number, status: "ACCEPTED" | "REJECTED") => {
    updateRequest.mutate(
      { id: requestId, data: { status } },
      {
        onSuccess: () => {
          toast({ title: `Request ${status.toLowerCase()}`, description: "Rider has been notified." });
          queryClient.invalidateQueries({ queryKey: getListRideRequestsQueryKey(rideId) });
          queryClient.invalidateQueries({ queryKey: getListMyRidesQueryKey() });
        },
        onError: (err: any) => {
          toast({ title: "Failed to update", description: err?.message || "An error occurred", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="divide-y border-t bg-muted/20">
      {requests.map((req) => (
        <div
          key={req.id}
          className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
              {req.rider_name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-sm flex items-center gap-2">
                <span>{req.rider_name}</span>
                {req.requested_seats > 1 && (
                  <Badge variant="secondary" className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-500/10 text-amber-600 border-0 shrink-0">
                    {req.requested_seats} seats
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground flex gap-2 items-center flex-wrap">
                <span>{req.rider_university || "Unknown Uni"}</span>
                {req.rider_gender && <span>• {req.rider_gender}</span>}
              </div>

              {/* Rider phone — revealed to driver when ACCEPTED */}
              {req.status === "ACCEPTED" && req.rider_phone && (
                <a
                  href={`tel:${req.rider_phone}`}
                  className="inline-flex items-center gap-1.5 mt-1.5 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 rounded-md px-2.5 py-1 text-xs font-semibold hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
                >
                  <Phone className="w-3 h-3" />
                  {req.rider_phone}
                </a>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
            {req.status === "PENDING" ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => handleUpdateStatus(req.id, "REJECTED")}
                  disabled={updateRequest.isPending || rideStatus === "COMPLETED" || rideStatus === "CANCELLED"}
                >
                  <X className="w-4 h-4 mr-1" /> Reject
                </Button>
                <Button
                  size="sm"
                  className="h-8 bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => handleUpdateStatus(req.id, "ACCEPTED")}
                  disabled={updateRequest.isPending || availableSeats < req.requested_seats || rideStatus === "COMPLETED" || rideStatus === "CANCELLED"}
                >
                  <Check className="w-4 h-4 mr-1" /> Accept
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <Badge variant="outline" className={getStatusColor(req.status)}>
                  {req.status}
                </Badge>
                {req.status === "ACCEPTED" && rideStatus !== "COMPLETED" && rideStatus !== "CANCELLED" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => {
                      if (confirm(`Are you sure you want to kick ${req.rider_name} out of this ride?`)) {
                        handleUpdateStatus(req.id, "REJECTED");
                      }
                    }}
                    disabled={updateRequest.isPending}
                  >
                    <X className="w-3.5 h-3.5 mr-1" /> Kick Out
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MyRides() {
  const { data: rides, isLoading } = useListMyRides({ query: { queryKey: getListMyRidesQueryKey() } });
  const updateRide = useUpdateRide();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleCancelRide = (id: number) => {
    if (confirm("Are you sure you want to cancel this ride? This action cannot be undone.")) {
      updateRide.mutate(
        { id, data: { status: "CANCELLED" } },
        {
          onSuccess: () => {
            toast({ title: "Ride Cancelled", description: "The ride has been marked as cancelled." });
            queryClient.invalidateQueries({ queryKey: getListMyRidesQueryKey() });
          },
        }
      );
    }
  };

  const handleCompleteRide = (id: number) => {
    updateRide.mutate(
      { id, data: { status: "COMPLETED" } },
      {
        onSuccess: () => {
          toast({ title: "Ride Completed", description: "The ride has been marked as completed." });
          queryClient.invalidateQueries({ queryKey: getListMyRidesQueryKey() });
        },
      }
    );
  };

  const activeRides = rides?.filter((r) => r.status === "OPEN" || r.status === "FULL") ?? [];
  const pastRides = rides?.filter((r) => r.status === "COMPLETED" || r.status === "CANCELLED") ?? [];

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">My Posted Rides</h1>
          <p className="text-muted-foreground mt-2">
            Manage rides you've offered and requests from passengers.
          </p>
        </div>
        <Button asChild className="hidden sm:flex">
          <Link href="/rides/new">Post New Ride</Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      ) : !rides || rides.length === 0 ? (
        <div className="text-center py-20 bg-card border border-dashed rounded-2xl">
          <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-bold mb-2">No rides posted yet</h3>
          <p className="text-muted-foreground max-w-sm mx-auto mb-6">
            You haven't offered any rides. Start carpooling and sharing costs today.
          </p>
          <Button asChild>
            <Link href="/rides/new">Post a Ride</Link>
          </Button>
        </div>
      ) : (
        <Tabs defaultValue="active" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px] bg-muted/60 p-1 rounded-xl">
            <TabsTrigger value="active" className="font-semibold rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Active Offers ({activeRides.length})
            </TabsTrigger>
            <TabsTrigger value="past" className="font-semibold rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Past & Cancelled ({pastRides.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4 outline-none">
            {activeRides.length === 0 ? (
              <div className="text-center py-12 bg-card border border-dashed rounded-2xl text-muted-foreground text-sm font-medium">
                No active ride offers.
              </div>
            ) : (
              <Accordion type="multiple" className="space-y-4">
                {activeRides.map((ride) => (
                  <AccordionItem
                    key={ride.id}
                    value={`ride-${ride.id}`}
                    className="bg-card border rounded-2xl overflow-hidden shadow-sm px-0"
                  >
                    <AccordionTrigger className="hover:no-underline px-6 py-4 data-[state=open]:border-b">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full text-left pr-4 gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 font-bold text-lg flex-wrap">
                            <span>{ride.origin}</span>
                            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span>{ride.destination}</span>
                          </div>
                          <div className="flex items-center gap-4 text-sm font-medium text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" /> {formatDateTime(ride.departure_time)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="w-3.5 h-3.5" /> {ride.available_seats} seats
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {ride.request_count ? (
                            <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                              {ride.request_count} Requests
                            </Badge>
                          ) : null}
                          <Badge variant="outline" className={`border-0 ${getStatusColor(ride.status)}`}>
                            {ride.status}
                          </Badge>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-0">
                      <div className="p-6 bg-card border-b flex justify-between items-center gap-4 flex-wrap">
                        <div className="text-sm font-medium">
                          Fare: <span className="text-primary font-bold">{formatPKR(ride.fare)}</span>
                        </div>
                        {ride.status === "OPEN" || ride.status === "FULL" ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive border-destructive/20 hover:bg-destructive/10"
                              onClick={() => handleCancelRide(ride.id)}
                              disabled={updateRide.isPending}
                            >
                              Cancel Ride
                            </Button>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleCompleteRide(ride.id)}
                              disabled={updateRide.isPending}
                            >
                              Mark Completed
                            </Button>
                          </div>
                        ) : null}
                      </div>
                      <RideRequests rideId={ride.id} availableSeats={ride.available_seats} rideStatus={ride.status} />
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </TabsContent>

          <TabsContent value="past" className="space-y-4 outline-none">
            {pastRides.length === 0 ? (
              <div className="text-center py-12 bg-card border border-dashed rounded-2xl text-muted-foreground text-sm font-medium">
                No past or cancelled rides.
              </div>
            ) : (
              <Accordion type="multiple" className="space-y-4">
                {pastRides.map((ride) => (
                  <AccordionItem
                    key={ride.id}
                    value={`ride-${ride.id}`}
                    className="bg-card border rounded-2xl overflow-hidden shadow-sm px-0 opacity-80"
                  >
                    <AccordionTrigger className="hover:no-underline px-6 py-4 data-[state=open]:border-b">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full text-left pr-4 gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 font-bold text-lg flex-wrap">
                            <span>{ride.origin}</span>
                            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span>{ride.destination}</span>
                          </div>
                          <div className="flex items-center gap-4 text-sm font-medium text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" /> {formatDateTime(ride.departure_time)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="w-3.5 h-3.5" /> {ride.available_seats} seats
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <Badge variant="outline" className={`border-0 ${getStatusColor(ride.status)}`}>
                            {ride.status}
                          </Badge>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-0">
                      <div className="p-6 bg-card border-b flex justify-between items-center gap-4 flex-wrap">
                        <div className="text-sm font-medium">
                          Fare: <span className="text-primary font-bold">{formatPKR(ride.fare)}</span>
                        </div>
                      </div>
                      <RideRequests rideId={ride.id} availableSeats={ride.available_seats} rideStatus={ride.status} />
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
