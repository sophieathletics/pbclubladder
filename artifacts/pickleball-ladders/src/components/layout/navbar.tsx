import { Link, useLocation } from "wouter";
import { useGetCurrentPlayer, useLogoutPlayer, useListNotifications } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Loader2, Menu, Bell, Trophy, User, Shield, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";

export function Navbar() {
  const { data: player, isLoading } = useGetCurrentPlayer();
  const logout = useLogoutPlayer();
  const [, setLocation] = useLocation();

  const { data: notificationsData } = useListNotifications(
    { unread_only: true },
    { query: { enabled: !!player } }
  );

  const unreadCount = notificationsData?.unreadCount || 0;

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        setLocation("/login");
      },
    });
  };

  const NavLinks = () => (
    <>
      <Link href="/leaderboard" className="text-sm font-medium hover:text-primary transition-colors" data-testid="link-leaderboard">
        Leaderboard
      </Link>
      {player && (
        <>
          <Link href="/dashboard" className="text-sm font-medium hover:text-primary transition-colors" data-testid="link-dashboard">
            Dashboard
          </Link>
          <Link href="/team" className="text-sm font-medium hover:text-primary transition-colors" data-testid="link-team">
            My Team
          </Link>
          <Link href="/challenge" className="text-sm font-medium hover:text-primary transition-colors" data-testid="link-challenge">
            Challenge
          </Link>
          {player.role === "admin" && (
            <Link href="/admin" className="text-sm font-medium text-destructive hover:text-destructive/80 transition-colors flex items-center gap-1" data-testid="link-admin">
              <Shield className="w-4 h-4" />
              Admin
            </Link>
          )}
        </>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2" data-testid="link-home">
            <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
              <Trophy className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight hidden sm:inline-block text-primary">
              Pickleball Club Ladder
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <NavLinks />
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          ) : player ? (
            <div className="flex items-center gap-4">
              <Link href="/notifications" className="relative text-muted-foreground hover:text-primary transition-colors" data-testid="link-notifications">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center p-0 text-[10px]">
                    {unreadCount}
                  </Badge>
                )}
              </Link>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full" data-testid="button-user-menu">
                    <User className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{player.fullName}</p>
                      <p className="text-xs leading-none text-muted-foreground">{player.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="w-full cursor-pointer" data-testid="menu-profile">Profile Settings</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive cursor-pointer" data-testid="menu-logout">
                    <LogOut className="w-4 h-4 mr-2" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" asChild data-testid="link-login">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild data-testid="link-register">
                <Link href="/register">Register</Link>
              </Button>
            </div>
          )}

          {/* Mobile menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" data-testid="button-mobile-menu">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64 flex flex-col gap-6 pt-10">
              <NavLinks />
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
