import { useLocation } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRegister } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Car } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 chars"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 chars"),
  phone_number: z.string().min(10, "Phone number required"),
  university: z.string().min(2, "University required"),
  gender: z.enum(["M", "F", "O"]),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function Register() {
  const [, setLocation] = useLocation();
  const { setToken } = useAuth();
  const { toast } = useToast();
  const registerMutation = useRegister();

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: "", email: "", password: "", phone_number: "", university: "", gender: "O" },
  });

  const onSubmit = (data: RegisterFormValues) => {
    registerMutation.mutate({ data }, {
      onSuccess: (res) => {
        setToken(res.token);
        toast({ title: "Welcome!", description: `Account created for ${res.user.username}` });
        setLocation("/");
      },
      onError: (err: any) => {
        toast({ title: "Registration failed", description: err?.message || "Error creating account", variant: "destructive" });
      }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <div className="w-full max-w-md bg-card border rounded-2xl shadow-sm p-8 my-8">
        <div className="flex justify-center mb-6 text-primary">
          <Car className="w-12 h-12" />
        </div>
        <h1 className="text-2xl font-bold text-center mb-2">Join CampusRide</h1>
        <p className="text-center text-muted-foreground mb-8">Find your campus commute</p>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="username" render={({ field }) => (
              <FormItem><FormLabel>Username</FormLabel><FormControl><Input placeholder="student123" {...field} /></FormControl><FormMessage /></FormItem>
            )}/>
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="student@uni.edu" {...field} /></FormControl><FormMessage /></FormItem>
            )}/>
            <FormField control={form.control} name="password" render={({ field }) => (
              <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl><FormMessage /></FormItem>
            )}/>
            <FormField control={form.control} name="phone_number" render={({ field }) => (
              <FormItem><FormLabel>Phone</FormLabel><FormControl><Input placeholder="+92 300 0000000" {...field} /></FormControl><FormMessage /></FormItem>
            )}/>
            <FormField control={form.control} name="university" render={({ field }) => (
              <FormItem><FormLabel>University</FormLabel><FormControl><Input placeholder="XYZ University" {...field} /></FormControl><FormMessage /></FormItem>
            )}/>
            <FormField control={form.control} name="gender" render={({ field }) => (
              <FormItem>
                <FormLabel>Gender</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="M">Male</SelectItem>
                    <SelectItem value="F">Female</SelectItem>
                    <SelectItem value="O">Other</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}/>
            <Button type="submit" className="w-full mt-6" disabled={registerMutation.isPending}>
              {registerMutation.isPending ? "Creating account..." : "Sign Up"}
            </Button>
          </form>
        </Form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account? <span className="text-primary font-medium cursor-pointer" onClick={() => setLocation("/login")}>Sign in</span>
        </p>
      </div>
    </div>
  );
}
