import { useGetStatsSummary, getGetStatsSummaryQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Car, Users, MapPin, Activity, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { data: stats, isLoading } = useGetStatsSummary({ query: { queryKey: getGetStatsSummaryQueryKey() } });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl mt-8" />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Overview</h1>
        <p className="text-muted-foreground mt-2">Platform activity and your personal stats.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* <Card className="border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open Rides</CardTitle>
            <Car className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total_open_rides}</div>
            <p className="text-xs text-muted-foreground mt-1">Available</p>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Seats</CardTitle>
            <Users className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total_seats_available}</div>
            <p className="text-xs text-muted-foreground mt-1">Ready to be booked</p>
          </CardContent>
        </Card> */}

        <Card className="border shadow-sm bg-primary/5 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-primary">Your Rides</CardTitle>
            <Activity className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{stats.my_rides_count}</div>
            <p className="text-xs text-primary/80 mt-1">Rides you've posted</p>
          </CardContent>
        </Card>

        <Card className="border shadow-sm bg-secondary/10 border-secondary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-secondary-foreground">Your Requests</CardTitle>
            <MapPin className="w-4 h-4 text-secondary-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-secondary-foreground">{stats.my_requests_count}</div>
            <p className="text-xs text-secondary-foreground/80 mt-1">{stats.my_pending_requests} pending</p>
          </CardContent>
        </Card>
      </div>

      {stats.popular_routes && stats.popular_routes.length > 0 && (
        <Card className="border shadow-sm col-span-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Popular Routes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.popular_routes.map((route, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border">
                  <div className="flex items-center gap-3 font-semibold">
                    <span className="truncate max-w-[120px] sm:max-w-xs">{route.origin}</span>
                    <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="truncate max-w-[120px] sm:max-w-xs">{route.destination}</span>
                  </div>
                  <Badge variant="secondary" className="bg-primary/10 text-primary shrink-0">
                    {route.count} rides
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
