import { useListMonitors } from '@workspace/api-client-react';
import { MonitorCard } from './MonitorCard';
import { Card, CardContent } from '@/components/ui/card';
import { Activity, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

function StatCard({ title, value, icon: Icon, valueClass, desc }) {
  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <Icon className={cn("h-4 w-4", valueClass || "text-muted-foreground")} />
        </div>
        <div className="mt-4 flex items-baseline gap-2">
          <h2 className={cn("text-3xl font-bold tracking-tight", valueClass)}>{value}</h2>
          {desc && <span className="text-xs text-muted-foreground font-mono">{desc}</span>}
        </div>
      </CardContent>
    </Card>);

}

export function Dashboard() {
  const { data: monitors, isLoading, isError } = useListMonitors();

  const total = monitors?.length || 0;
  const up = monitors?.filter((m) => m.currentStatus === 'UP').length || 0;
  const down = monitors?.filter((m) => m.currentStatus === 'DOWN').length || 0;

  const validTimes = monitors?.map((m) => m.lastResponseTimeMs).filter(Boolean);
  const avgResponseTime = validTimes && validTimes.length > 0 ?
  Math.round(validTimes.reduce((a, b) => a + b, 0) / validTimes.length) :
  0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground mt-1">Real-time status of your monitored endpoints.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ?
        Array.from({ length: 4 }).map((_, i) =>
        <Card key={i} className="border-border/50"><CardContent className="p-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
        ) :

        <>
            <StatCard title="Total Monitors" value={total} icon={Activity} />
            <StatCard title="Healthy" value={up} icon={CheckCircle2} valueClass="text-[hsl(var(--status-up))]" />
            <StatCard title="Failing" value={down} icon={AlertCircle} valueClass={down > 0 ? "text-[hsl(var(--status-down))]" : "text-muted-foreground"} />
            <StatCard title="Avg Response" value={avgResponseTime} desc="ms" icon={Clock} valueClass="font-mono" />
          </>
        }
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold tracking-tight">Active Monitors</h2>
        </div>

        {isLoading ?
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) =>
          <Card key={i} className="border-border/50"><CardContent className="p-6"><Skeleton className="h-32 w-full" /></CardContent></Card>
          )}
          </div> :
        isError ?
        <div className="p-8 text-center border rounded-lg border-destructive/20 bg-destructive/5 text-destructive">
            Failed to load monitors. Please try again.
          </div> :
        monitors?.length === 0 ?
        <div className="p-12 text-center border border-dashed rounded-lg border-border/50 bg-card/20">
            <Activity className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-1">No monitors configured</h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
              You haven't added any endpoints to monitor yet. Click the + button in the corner to get started.
            </p>
          </div> :

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {monitors?.map((monitor, i) =>
          <MonitorCard
            key={monitor.id}
            monitor={monitor}
            style={{ animationDelay: `${i * 50}ms` }} />

          )}
          </div>
        }
      </div>
    </div>);

}