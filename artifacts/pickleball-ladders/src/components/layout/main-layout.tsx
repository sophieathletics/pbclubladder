import { ReactNode } from "react";
import { Navbar } from "./navbar";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-gray-50/50 dark:bg-background">
      <Navbar />
      <main className="flex-1 w-full max-w-7xl mx-auto">
        {children}
      </main>
    </div>
  );
}
