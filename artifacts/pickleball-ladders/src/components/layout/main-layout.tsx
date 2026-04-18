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
      <footer className="border-t mt-10 py-6 px-4 text-center text-sm text-muted-foreground">
        Want to organize a ladder?{" "}
        <a
          href="mailto:info@pbclubladder.com"
          className="text-primary font-medium hover:underline"
          data-testid="link-organize-ladder"
        >
          info@pbclubladder.com
        </a>
      </footer>
    </div>
  );
}
