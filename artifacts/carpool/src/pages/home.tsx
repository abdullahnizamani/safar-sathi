import { useState } from "react";
import { useListRides } from "@workspace/api-client-react";
import RideCard from "@/components/ride-card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Calendar as CalendarIcon, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { MapboxGeocoder, type GeocoderResult } from "@/components/mapbox-geocoder";

interface SearchCoords {
  placeName: string;
  lat: number | null;
  lng: number | null;
}

const emptyCoords = (): SearchCoords => ({ placeName: "", lat: null, lng: null });

export default function Home() {
  const [origin, setOrigin] = useState<SearchCoords>(emptyCoords());
  const [dest, setDest] = useState<SearchCoords>(emptyCoords());
  const [date, setDate] = useState<Date>();
  const [genderPref, setGenderPref] = useState<string>("ANY");

  // "Committed" search state — only applied when user hits Search
  const [committed, setCommitted] = useState<{
    origin: SearchCoords;
    dest: SearchCoords;
    date?: Date;
    gender: string;
  }>({ origin: emptyCoords(), dest: emptyCoords(), gender: "ANY" });

  const handleSearch = () => {
    setCommitted({ origin, dest, date, gender: genderPref });
  };

  const handleClear = () => {
    const blank = emptyCoords();
    setOrigin(blank);
    setDest(blank);
    setDate(undefined);
    setGenderPref("ANY");
    setCommitted({ origin: blank, dest: blank, gender: "ANY" });
  };

  const { data: rides, isLoading } = useListRides({
    origin: committed.origin.placeName || undefined,
    destination: committed.dest.placeName || undefined,
    date: committed.date ? format(committed.date, "yyyy-MM-dd") : undefined,
    gender_preference: committed.gender !== "ANY" ? (committed.gender as any) : undefined,
    // Proximity coords — only sent when coordinates are captured from geocoder
    ...(committed.origin.lat != null && committed.origin.lng != null
      ? { origin_lat: committed.origin.lat, origin_lng: committed.origin.lng }
      : {}),
    ...(committed.dest.lat != null && committed.dest.lng != null
      ? { dest_lat: committed.dest.lat, dest_lng: committed.dest.lng }
      : {}),
  });

  const hasFilters =
    !!origin.placeName || !!dest.placeName || !!date || genderPref !== "ANY";

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section className="bg-card border rounded-2xl p-6 shadow-sm">
        <h1 className="text-2xl font-bold mb-6 text-foreground">Find a ride</h1>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Origin geocoder */}
          <div className="md:col-span-3">
            <MapboxGeocoder
              placeholder="Leaving from..."
              value={origin.placeName}
              onSelect={(r: GeocoderResult) =>
                setOrigin({ placeName: r.placeName, lat: r.lat, lng: r.lng })
              }
              onClear={() => setOrigin(emptyCoords())}
            />
          </div>

          {/* Destination geocoder */}
          <div className="md:col-span-3">
            <MapboxGeocoder
              placeholder="Going to..."
              value={dest.placeName}
              onSelect={(r: GeocoderResult) =>
                setDest({ placeName: r.placeName, lat: r.lat, lng: r.lng })
              }
              onClear={() => setDest(emptyCoords())}
            />
          </div>

          {/* Date picker */}
          <div className="md:col-span-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal bg-background/50 border-border/60",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : <span>Date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Gender preference */}
          <div className="md:col-span-2">
            <Select value={genderPref} onValueChange={setGenderPref}>
              <SelectTrigger className="bg-background/50 border-border/60">
                <SelectValue placeholder="Gender Pref" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ANY">Any Gender</SelectItem>
                <SelectItem value="MALE">Male Only</SelectItem>
                <SelectItem value="FEMALE">Female Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="md:col-span-2 flex gap-2">
            <Button onClick={handleSearch} className="flex-1 font-bold">
              Search
            </Button>
            {hasFilters && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClear}
                className="shrink-0 text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-foreground">Available Rides</h2>
          <span className="text-sm text-muted-foreground font-medium">
            {rides?.length || 0} rides found
          </span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="border rounded-2xl p-5 space-y-4">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="grid grid-cols-2 gap-2 pt-4 border-t">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : rides?.length === 0 ? (
          <div className="text-center py-20 bg-card border border-dashed rounded-2xl">
            <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-bold mb-2">No rides found</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              We couldn't find any rides matching your search. Try adjusting your
              filters or check back later.
            </p>
            <Button variant="outline" className="mt-6" onClick={handleClear}>
              Clear Filters
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rides?.map((ride, i) => (
              <div
                key={ride.id}
                className="animate-in fade-in slide-in-from-bottom-4"
                style={{
                  animationDelay: `${i * 50}ms`,
                  animationFillMode: "both",
                }}
              >
                <RideCard ride={ride} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
