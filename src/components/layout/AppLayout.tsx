import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Shield,
  LayoutDashboard,
  Upload,
  History,
  Settings,
  LogOut,
  User,
  ChevronRight,
  Globe,
  RefreshCw,
  FileText,
} from 'lucide-react';

interface AppLayoutProps {
  children: ReactNode;
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/new-check', label: 'New Check', icon: Upload },
  { href: '/history', label: 'History', icon: History },
];

const adminNavItems = [
  { href: '/admin/rules', label: 'Manage Rules', icon: Settings },
  { href: '/admin/states', label: 'Manage States', icon: Globe },
  { href: '/admin/rule-updates', label: 'Rule Updates', icon: RefreshCw },
  { href: '/admin/audit-log', label: 'Audit Log', icon: FileText },
];

export default function AppLayout({ children }: AppLayoutProps) {
  const { user, profile, isAdmin, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar border-r-2 border-sidebar-border flex flex-col">
        {/* Logo */}
        <div className="p-4 border-b-2 border-sidebar-border">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-sidebar-primary flex items-center justify-center">
              <Shield className="w-6 h-6 text-sidebar-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-sidebar-foreground">CannLabel</h1>
              <p className="text-xs text-muted-foreground">Compliance</p>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors border-2',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground border-sidebar-border shadow-xs'
                    : 'text-sidebar-foreground border-transparent hover:bg-sidebar-accent hover:border-sidebar-border'
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
                {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
              </Link>
            );
          })}

          {isAdmin && (
            <>
              <div className="pt-4 pb-2">
                <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Admin
                </p>
              </div>
              {adminNavItems.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors border-2',
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground border-sidebar-border shadow-xs'
                        : 'text-sidebar-foreground border-transparent hover:bg-sidebar-accent hover:border-sidebar-border'
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                    {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        {/* User section */}
        <div className="p-4 border-t-2 border-sidebar-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-sidebar-accent flex items-center justify-center border-2 border-sidebar-border">
              <User className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {profile?.full_name || user?.email?.split('@')[0]}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user?.email}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
