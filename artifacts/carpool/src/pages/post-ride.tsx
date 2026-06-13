import { useLocation } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateRide, getListRidesQueryKey, getListMyRidesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

const rideSchema = z.object({
  origin: z.string().min(1, "Origin is required"),
  destination: z.string().min(1, "Destination is required"),
  departure_time: z.string().min(1, "Departure time is required"),
  available_seats: z.coerce.number().min(1, "At least 1 seat"),
  fare: z.coerce.number().min(0, "Fare must be 0 or more"),
  transport_type: z.string().min(1, "Transport type is required"),
  gender_preference: z.enum(["ANY", "MALE", "FEMALE"]),
});

type RideFormValues = z.infer<typeof rideSchema>;

export default function PostRide() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createRide = useCreateRide();

  // set default departure time to tomorrow 9am
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  const defaultDepartureTime = tomorrow.toISOString().slice(0, 16); // YYYY-MM-DDThh:mm

  const form = useForm<RideFormValues>({
    resolver: zodResolver(rideSchema),
    defaultValues: { 
      origin: "", 
      destination: "", 
      departure_time: defaultDepartureTime,
      available_seats: 3,
      fare: 500,
      transport_type: "Car",
      gender_preference: "ANY"
    },
  });

  const onSubmit = (data: RideFormValues) => {
    // ensure proper ISO format with timezone for API
    const isoDate = new Date(data.departure_time).toISOString();
    
    createRide.mutate({ data: { ...data, departure_time: isoDate } }, {
      onSuccess: (ride) => {
        toast({ title: "Ride Posted!", description: "Your ride has been successfully published." });
        queryClient.invalidateQueries({ queryKey: getListRidesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListMyRidesQueryKey() });
        setLocation(`/rides/${ride.id}`);
      },
      onError: (err: any) => {
        toast({ title: "Failed to post ride", description: err?.message || "An error occurred", variant: "destructive" });
      }
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-4 text-muted-foreground -ml-2">
          <Link href="/"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Rides</Link>
        </Button>
        <h1 className="text-3xl font-extrabold tracking-tight">Post a Ride</h1>
        <p className="text-muted-foreground mt-2 text-lg">Share your journey and split the cost.</p>
      </div>

      <Card className="border shadow-sm">
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="origin" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Leaving from</FormLabel>
                    <FormControl><Input placeholder="e.g. DHA Phase 6" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>
                
                <FormField control={form.control} name="destination" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Going to</FormLabel>
                    <FormControl><Input placeholder="e.g. LUMS Main Campus" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="departure_time" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Departure Time</FormLabel>
                    <FormControl><Input type="datetime-local" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>

                <FormField control={form.control} name="transport_type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transport Type</FormLabel>
                    <FormControl><Input placeholder="e.g. Honda Civic, Uber" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField control={form.control} name="available_seats" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Available Seats</FormLabel>
                    <FormControl><Input type="number" min={1} max={10} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>

                <FormField control={form.control} name="fare" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fare (PKR) per seat</FormLabel>
                    <FormControl><Input type="number" min={0} step={50} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>

                <FormField control={form.control} name="gender_preference" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender Preference</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ANY">Any</SelectItem>
                        <SelectItem value="MALE">Male Only</SelectItem>
                        <SelectItem value="FEMALE">Female Only</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}/>
              </div>

              <Button type="submit" size="lg" className="w-full font-bold text-md mt-4" disabled={createRide.isPending}>
                {createRide.isPending ? "Publishing..." : "Post Ride"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
