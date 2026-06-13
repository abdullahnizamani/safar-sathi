import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useGetMe } from "@workspace/api-client-react";
import { LogOut, Home, PlusCircle, Car, Map, User, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function Layout({ children }: { children: ReactNode }) {
  const { isAuthenticated, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { data: user, isLoading } = useGetMe({ query: { enabled: isAuthenticated } });

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-card">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-primary font-bold text-xl tracking-tight">
            <Car className="w-6 h-6" />
            <span>CampusRide</span>
          </Link>
          
          {isAuthenticated ? (
            <div className="flex items-center gap-4">
              <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
                <Link href="/" className="hover:text-primary transition-colors">Find a Ride</Link>
                <Link href="/rides/new" className="hover:text-primary transition-colors">Post a Ride</Link>
                <Link href="/my-rides" className="hover:text-primary transition-colors">My Posts</Link>
                <Link href="/my-requests" className="hover:text-primary transition-colors">My Requests</Link>
                <Link href="/dashboard" className="hover:text-primary transition-colors">Dashboard</Link>
              </nav>
              <div className="flex items-center gap-3 border-l pl-4">
                {isLoading ? (
                  <Skeleton className="w-24 h-5" />
                ) : (
                  <span className="text-sm font-semibold truncate max-w-[120px]">{user?.username}</span>
                )}
                <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-destructive">
                  <LogOut className="w-5 h-5" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Button variant="ghost" asChild>
                <Link href="/login">Log In</Link>
              </Button>
              <Button asChild>
                <Link href="/register">Sign Up</Link>
              </Button>
            </div>
          )}
        </div>
      </header>
      
      <main className="flex-1 container mx-auto px-4 py-8">
        {children}
      </main>
      
      {/* Mobile Nav */}
      {isAuthenticated && (
        <nav className="md:hidden sticky bottom-0 left-0 right-0 border-t bg-card flex justify-around p-3 pb-safe z-50">
          <Link href="/" className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary">
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-medium">Home</span>
          </Link>
          <Link href="/my-requests" className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary">
            <Map className="w-5 h-5" />
            <span className="text-[10px] font-medium">Requests</span>
          </Link>
          <Link href="/rides/new" className="flex flex-col items-center gap-1 text-primary">
            <PlusCircle className="w-6 h-6" />
            <span className="text-[10px] font-bold">Post</span>
          </Link>
          <Link href="/my-rides" className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary">
            <Car className="w-5 h-5" />
            <span className="text-[10px] font-medium">My Rides</span>
          </Link>
          <Link href="/dashboard" className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary">
            <Activity className="w-5 h-5" />
            <span className="text-[10px] font-medium">Stats</span>
          </Link>
        </nav>
      )}
    </div>
  );
}
