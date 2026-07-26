import { Link } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { MonitorWithStatus } from '@workspace/api-client-react';
import { Activity, Clock, Globe, ArrowRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

export function MonitorCard({ monitor, style }) {
  const isUp = monitor.currentStatus === 'UP';
  const isDown = monitor.currentStatus === 'DOWN';
  const isPending = !monitor.currentStatus;

  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all duration-300 hover-elevate border-border/50 cursor-pointer",
        isDown && "border-[hsl(var(--status-down))]/50 bg-[hsl(var(--status-down))]/5"
      )}
      style={style}>
      
      <Link href={`/monitors/${monitor.id}`} className="absolute inset-0 z-10">
        <span className="sr-only">View {monitor.name || monitor.url}</span>
      </Link>
      
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="space-y-1 pr-4">
            <h3 className="font-semibold text-lg flex items-center gap-2 truncate">
              {monitor.name || new URL(monitor.url).hostname}
            </h3>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 font-mono truncate">
              <Globe className="h-3 w-3" />
              {monitor.url}
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <div className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider",
              isUp ? "bg-[hsl(var(--status-up))]/10 text-[hsl(var(--status-up))] border border-[hsl(var(--status-up))]/20" :
              isDown ? "bg-[hsl(var(--status-down))]/10 text-[hsl(var(--status-down))] border border-[hsl(var(--status-down))]/20 animate-pulse" :
              "bg-muted text-muted-foreground border border-border"
            )}>
              <span className={cn(
                "h-1.5 w-1.5 rounded-full",
                isUp ? "bg-[hsl(var(--status-up))]" :
                isDown ? "bg-[hsl(var(--status-down))]" : "bg-muted-foreground"
              )} />
              {monitor.currentStatus || 'PENDING'}
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Response Time</p>
            <div className="flex items-baseline gap-1.5">
              <Activity className={cn("h-4 w-4",
              monitor.lastResponseTimeMs && monitor.lastResponseTimeMs > 1000 ? "text-[hsl(var(--status-latency))]" : "text-muted-foreground"
              )} />
              <span className="text-xl font-mono font-medium">
                {monitor.lastResponseTimeMs ? `${monitor.lastResponseTimeMs}ms` : '--'}
              </span>
            </div>
          </div>
          
          <div className="space-y-1.5">
            <div className="flex justify-between items-baseline">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Uptime</p>
              <span className="text-sm font-mono">{monitor.uptimePercent ? monitor.uptimePercent.toFixed(2) : '0.00'}%</span>
            </div>
            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-1000 ease-out",
                (monitor.uptimePercent || 0) > 99 ? "bg-[hsl(var(--status-up))]" :
                (monitor.uptimePercent || 0) > 95 ? "bg-[hsl(var(--status-latency))]" : "bg-[hsl(var(--status-down))]"
                )}
                style={{ width: `${Math.max(monitor.uptimePercent || 0, 2)}%` }} />
              
            </div>
          </div>
        </div>
        
        <div className="mt-6 pt-4 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            Interval: {monitor.intervalSeconds}s
          </div>
          <div>
            {monitor.lastCheckedAt ? `Checked ${formatDistanceToNow(new Date(monitor.lastCheckedAt), { addSuffix: true })}` : 'Waiting for first check...'}
          </div>
        </div>
      </CardContent>
    </Card>);

}