import { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import NotificationDropdown from '@/components/NotificationDropdown';


interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const { user } = useAuth();

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1">
          {/* Slim Header */}
          <header className="sticky top-0 z-50 flex h-14 items-center gap-4 border-b border-[hsl(222,33%,25%)] bg-[hsl(222,33%,17%)] text-white px-4">
            <SidebarTrigger className="-ml-1 text-white hover:bg-white/10 hover:text-white" />
            <div className="flex items-center gap-2">
              <img 
                src="https://utthunga.com/wp-content/uploads/2024/10/Utthunga-Logo-White.png.webp"
                alt="Utthunga"
                className="h-7 object-contain md:hidden"
              />
              <span className="font-semibold hidden sm:inline">Performance Management System</span>
              <span className="font-semibold sm:hidden">PMS</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <NotificationDropdown />
            </div>
          </header>

          {/* Main content */}
          <main className="flex-1 p-6">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
