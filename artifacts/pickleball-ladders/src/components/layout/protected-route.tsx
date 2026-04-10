import { useLocation } from "wouter";
import { useGetCurrentPlayer } from "@workspace/api-client-react";
import { ReactNode, useEffect } from "react";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
  adminOnly?: boolean;
}

export function ProtectedRoute({ children, adminOnly = false }: ProtectedRouteProps) {
  const [, setLocation] = useLocation();
  const { data: player, isLoading, error } = useGetCurrentPlayer({
    query: {
      retry: false
    }
  });

  useEffect(() => {
    if (!isLoading) {
      if (error || !player) {
        setLocation("/login");
      } else if (adminOnly && player.role !== "admin") {
        setLocation("/dashboard");
      }
    }
  }, [isLoading, error, player, setLocation, adminOnly]);

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !player || (adminOnly && player.role !== "admin")) {
    return null;
  }

  return <>{children}</>;}
