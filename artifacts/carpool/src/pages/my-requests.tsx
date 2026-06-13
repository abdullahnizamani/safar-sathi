import { useListMyRequests, getListMyRequestsQueryKey } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime, formatPKR } from "@/lib/format";
import { getStatusColor } from "@/components/ride-card";
import { Clock, MapPin, ArrowRight, User, Map } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Link } from "wouter";

export default function MyRequests() {
  const { data: requests, isLoading } = useListMyRequests({ query: { queryKey: getListMyRequestsQueryKey() } });

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">My Ride Requests</h1>
        <p className="text-muted-foreground mt-2">Track the status of rides you've requested to join.</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
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
          <Button asChild><Link href="/">Find a Ride</Link></Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {requests.map(req => (
            <Card key={req.id} className="overflow-hidden border shadow-sm hover:shadow-md transition-shadow">
              <div className={`h-1.5 w-full ${req.status === 'ACCEPTED' ? 'bg-green-500' : req.status === 'REJECTED' ? 'bg-red-500' : 'bg-blue-400'}`} />
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row justify-between gap-6">
                  
                  {req.ride && (
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-2 font-bold text-lg">
                        <span>{req.ride.origin}</span>
                        <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span>{req.ride.destination}</span>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-muted-foreground">
                        <span className="flex items-center gap-1.5 bg-muted px-2.5 py-1 rounded-md">
                          <Clock className="w-4 h-4" /> {formatDateTime(req.ride.departure_time)}
                        </span>
                        <span className="flex items-center gap-1.5 bg-muted px-2.5 py-1 rounded-md">
                          <User className="w-4 h-4" /> {req.ride.driver_name}
                        </span>
                        <span className="font-bold text-primary px-2.5 py-1">
                          {formatPKR(req.ride.fare)}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-4 border-t md:border-t-0 md:border-l pt-4 md:pt-0 md:pl-6">
                    <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider text-center md:text-right">
                      Status
                    </div>
                    <Badge variant="outline" className={`text-sm px-3 py-1 font-bold border-0 shadow-none ${getStatusColor(req.status)}`}>
                      {req.status}
                    </Badge>
                  </div>

                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
