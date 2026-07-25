import { Link, useLocation } from 'wouter';
import { Activity, Bell, LayoutDashboard } from 'lucide-react';
import { useListMonitors, useListAlerts } from '@workspace/api-client-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export function Navbar() {
  const [location] = useLocation();
  const { data: monitors } = useListMonitors();
  const { data: alerts } = useListAlerts({ resolved: false });

  const unresolvedAlertsCount = alerts?.length || 0;
  const monitorsCount = monitors?.length || 0;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/80 backdrop-blur">
      <div className="container mx-auto flex h-14 items-center justify-between px-4 sm:px-8">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 mr-4 transition-opacity hover:opacity-80">
            <Activity className="h-5 w-5 text-primary" />
            <span className="font-semibold text-lg tracking-tight">Signal</span>
          </Link>
          <nav className="flex items-center gap-1">
            <Link href="/">
              <span className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors hover:bg-secondary hover:text-foreground",
                location === '/' ? "bg-secondary text-foreground" : "text-muted-foreground"
              )}>
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] rounded-full">{monitorsCount}</Badge>
              </span>
            </Link>
            <Link href="/alerts">
              <span className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors hover:bg-secondary hover:text-foreground",
                location === '/alerts' ? "bg-secondary text-foreground" : "text-muted-foreground"
              )}>
                <Bell className="h-4 w-4" />
                Alerts
                {unresolvedAlertsCount > 0 && (
                  <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px] rounded-full">{unresolvedAlertsCount}</Badge>
                )}
              </span>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
