import { Ride, RideGenderPreference, RideStatus } from "@workspace/api-client-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatPKR } from "@/lib/format";
import { MapPin, Clock, Users, ArrowRight, User, Star, Car } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface RideCardProps {
  ride: Ride;
}

export function getStatusColor(status: RideStatus | string) {
  switch (status) {
    case "OPEN": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    case "FULL": return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300";
    case "COMPLETED": return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    case "CANCELLED": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
    case "PENDING": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    case "ACCEPTED": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    case "REJECTED": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
    default: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
  }
}

export function getGenderPreferenceColor(pref: RideGenderPreference) {
  switch (pref) {
    case "MALE": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 border-blue-200";
    case "FEMALE": return "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300 border-pink-200";
    case "ANY": default: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-200";
  }
}

function DriverRating({ rating }: { rating: number | null | undefined }) {
  if (rating == null) return null;
  return (
    <div className="flex items-center gap-1" data-testid="driver-rating">
      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
      <span className="text-xs font-semibold text-amber-600">{rating.toFixed(1)}</span>
    </div>
  );
}

export default function RideCard({ ride }: RideCardProps) {
  return (
    <Link href={`/rides/${ride.id}`}>
      <Card
        className="glow-card cursor-pointer group border-border/60 shadow-sm"
        data-testid={`card-ride-${ride.id}`}
      >
        <CardHeader className="pb-3 px-5 pt-5">
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1 space-y-1 text-lg font-bold flex items-center flex-wrap gap-2 text-foreground">
              <span className="truncate max-w-[120px]">{ride.origin}</span>
              <ArrowRight className="w-5 h-5 text-muted-foreground shrink-0" />
              <span className="truncate max-w-[120px]">{ride.destination}</span>
            </div>
            <div className="text-right">
              <div className="text-xl font-extrabold text-primary">{formatPKR(ride.fare)}</div>
              <Badge variant="outline" className={cn("mt-1 whitespace-nowrap border-0 shadow-none", getStatusColor(ride.status))}>
                {ride.status}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pb-4 px-5 space-y-3">
          <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4 shrink-0 text-primary/70" />
              <span className="font-medium text-foreground/80">{formatDateTime(ride.departure_time)}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="w-4 h-4 shrink-0 text-primary/70" />
              <span className="font-medium text-foreground/80">
                {ride.available_seats} {ride.available_seats === 1 ? 'seat' : 'seats'} left
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="w-4 h-4 shrink-0 text-primary/70" />
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="truncate font-medium text-foreground/80" data-testid={`text-driver-${ride.id}`}>
                  {ride.driver_name}
                </span>
                <DriverRating rating={ride.driver_avg_rating} />
              </div>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Car className="w-4 h-4 shrink-0 text-primary/70" />
              <span className="truncate font-medium text-foreground/80">{ride.transport_type}</span>
            </div>
          </div>
        </CardContent>
        <CardFooter className="bg-muted/30 px-5 py-3 border-t flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn("text-[10px] uppercase tracking-wider font-bold", getGenderPreferenceColor(ride.gender_preference))}>
              {ride.gender_preference === 'ANY' ? 'ANY GENDER' : `${ride.gender_preference} ONLY`}
            </Badge>
          </div>
          {ride.request_count !== undefined && ride.request_count > 0 && (
            <div className="text-xs font-medium text-muted-foreground">
              {ride.request_count} request{ride.request_count !== 1 ? 's' : ''}
            </div>
          )}
        </CardFooter>
      </Card>
    </Link>
  );
}
