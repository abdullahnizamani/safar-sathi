import { useState } from "react";
import { useListRides } from "@workspace/api-client-react";
import RideCard from "@/components/ride-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, MapPin, Map, Calendar as CalendarIcon, SlidersHorizontal, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function Home() {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState<Date>();
  const [genderPref, setGenderPref] = useState<string>("ANY");
  
  const [debouncedOrigin, setDebouncedOrigin] = useState("");
  const [debouncedDestination, setDebouncedDestination] = useState("");

  const handleSearch = () => {
    setDebouncedOrigin(origin);
    setDebouncedDestination(destination);
  };

  const handleClear = () => {
    setOrigin("");
    setDestination("");
    setDebouncedOrigin("");
    setDebouncedDestination("");
    setDate(undefined);
    setGenderPref("ANY");
  };

  const { data: rides, isLoading } = useListRides({
    origin: debouncedOrigin || undefined,
    destination: debouncedDestination || undefined,
    date: date ? format(date, "yyyy-MM-dd") : undefined,
    gender_preference: genderPref !== "ANY" ? genderPref as any : undefined
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section className="bg-card border rounded-2xl p-6 shadow-sm">
        <h1 className="text-2xl font-bold mb-6 text-foreground">Find a ride</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-3 relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Leaving from..." 
              className="pl-9 bg-background/50 border-border/60 focus:bg-background"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          
          <div className="md:col-span-3 relative">
            <Map className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Going to..." 
              className="pl-9 bg-background/50 border-border/60 focus:bg-background"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>

          <div className="md:col-span-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal bg-background/50 border-border/60", !date && "text-muted-foreground")}>
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

          <div className="md:col-span-2 flex gap-2">
            <Button onClick={handleSearch} className="flex-1 font-bold">
              Search
            </Button>
            {(origin || destination || date || genderPref !== "ANY") && (
              <Button variant="ghost" size="icon" onClick={handleClear} className="shrink-0 text-muted-foreground">
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
              We couldn't find any rides matching your search. Try adjusting your filters or check back later.
            </p>
            <Button variant="outline" className="mt-6" onClick={handleClear}>
              Clear Filters
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rides?.map((ride, i) => (
              <div key={ride.id} className="animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'both' }}>
                <RideCard ride={ride} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
