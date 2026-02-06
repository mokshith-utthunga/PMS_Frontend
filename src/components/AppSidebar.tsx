import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  ClipboardCheck,
  Users,
  Settings,
  LogOut,
  BarChart3,
  Scale,
  Star,
  Target,
  Clock,
  FileCheck,
  ArrowRightLeft,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['employee', 'manager', 'dept_head', 'hr_admin', 'hrbp', 'system_admin'] },
  { name: 'My Goals', href: '/goals', icon: Target, roles: ['employee', 'manager', 'dept_head', 'hr_admin'] },
  { name: 'Self Evaluation', href: '/evaluations', icon: ClipboardCheck, roles: ['employee', 'manager', 'dept_head','hr_admin'] },
  { name: 'My Rating', href: '/my-rating', icon: Star, roles: ['employee', 'manager', 'dept_head','hr_admin'] },
  { name: 'Team', href: '/team', icon: Users, roles: ['manager', 'dept_head','hr_admin'] },
  { name: 'Calibration', href: '/calibration', icon: Scale, roles: ['hr_admin', 'hrbp'] },
  // { name: 'Reports', href: '/reports', icon: BarChart3, roles: ['hr_admin', 'hrbp', 'dept_head'] },
  { name: 'HR Review', href: '/admin/review', icon: FileCheck, roles: ['hr_admin', 'hrbp', 'system_admin', 'dept_head'] },
  { name: 'Late Submissions', href: '/admin/late-submissions', icon: Clock, roles: ['hr_admin', 'system_admin'] },
  { name: 'Transitions', href: '/admin/transitions', icon: ArrowRightLeft, roles: ['hr_admin', 'system_admin'] },
  { name: 'Admin', href: '/admin', icon: Settings, roles: ['hr_admin', 'system_admin'] },
];

export function AppSidebar() {
  const { user, roles, signOut, hasAnyRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();

  const isCollapsed = state === 'collapsed';

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const filteredNavigation = navigation.filter(item =>
    hasAnyRole(item.roles as any[])
  );

  const userInitials = user?.email?.substring(0, 2).toUpperCase() || 'U';

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/dashboard" className="flex items-center px-2 py-2">
          <img 
            src="https://utthunga.com/wp-content/uploads/2024/10/Utthunga-Logo-White.png.webp"
            alt="Utthunga"
            className={cn(
              "h-8 object-contain",
              isCollapsed ? "w-8" : "w-auto max-w-[140px]"
            )}
          />
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredNavigation.map((item) => {
                const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/');
                return (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.name}
                    >
                      <Link to={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className={cn(
              "flex items-center gap-3 px-2 py-2",
              isCollapsed && "justify-center"
            )}>
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              {!isCollapsed && (
                <div className="flex flex-col overflow-hidden">
                  <span className="text-sm font-medium truncate">{user?.email}</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {roles.slice(0, 2).map((role) => (
                      <Badge key={role} variant="secondary" className="text-xs">
                        {role.replace('_', ' ')}
                      </Badge>
                    ))}
                    {roles.length > 2 && (
                      <Badge variant="secondary" className="text-xs">
                        +{roles.length - 2}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleSignOut}
              tooltip="Sign out"
              className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
