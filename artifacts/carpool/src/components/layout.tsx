import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { LogOut, Home, PlusCircle, Car, Map, User, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function Layout({ children }: { children: ReactNode }) {
  const { isAuthenticated, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { data: user, isLoading } = useGetMe({ query: { queryKey: getGetMeQueryKey(), enabled: isAuthenticated } });

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  const initials = user?.username ? user.username.slice(0, 2).toUpperCase() : "?";

  const navLinks = [
    { href: "/", label: "Find a Ride" },
    { href: "/rides/new", label: "Post a Ride" },
    { href: "/my-rides", label: "My Posts" },
    { href: "/my-requests", label: "My Requests" },
    { href: "/dashboard", label: "Dashboard" },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-card">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-primary font-bold text-xl tracking-tight">
            <Car className="w-6 h-6" />
            <span>SafarSathi</span>
          </Link>
          
          {isAuthenticated ? (
            <div className="flex items-center gap-4">
              <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
                {navLinks.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className={`hover:text-primary transition-colors ${location === href ? "text-primary font-semibold" : ""}`}
                  >
                    {label}
                  </Link>
                ))}
              </nav>
              <div className="flex items-center gap-3 border-l pl-4">
                {isLoading ? (
                  <Skeleton className="w-8 h-8 rounded-full" />
                ) : (
                  <Link href="/profile" data-testid="link-profile">
                    <Avatar className="w-8 h-8 cursor-pointer border-2 border-primary/20 hover:border-primary/50 transition-colors">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </Link>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  className="text-muted-foreground hover:text-destructive"
                  data-testid="button-header-logout"
                >
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
          <Link href="/" className={`flex flex-col items-center gap-1 ${location === "/" ? "text-primary" : "text-muted-foreground"} hover:text-primary`}>
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-medium">Home</span>
          </Link>
          <Link href="/my-requests" className={`flex flex-col items-center gap-1 ${location === "/my-requests" ? "text-primary" : "text-muted-foreground"} hover:text-primary`}>
            <Map className="w-5 h-5" />
            <span className="text-[10px] font-medium">Requests</span>
          </Link>
          <Link href="/rides/new" className="flex flex-col items-center gap-1 text-primary">
            <PlusCircle className="w-6 h-6" />
            <span className="text-[10px] font-bold">Post</span>
          </Link>
          <Link href="/my-rides" className={`flex flex-col items-center gap-1 ${location === "/my-rides" ? "text-primary" : "text-muted-foreground"} hover:text-primary`}>
            <Car className="w-5 h-5" />
            <span className="text-[10px] font-medium">My Rides</span>
          </Link>
          <Link href="/profile" className={`flex flex-col items-center gap-1 ${location === "/profile" ? "text-primary" : "text-muted-foreground"} hover:text-primary`} data-testid="link-mobile-profile">
            <User className="w-5 h-5" />
            <span className="text-[10px] font-medium">Profile</span>
          </Link>
        </nav>
      )}
    </div>
  );
}
