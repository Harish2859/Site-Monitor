import { useRoute, useLocation } from 'wouter';
import { useListMonitors, useListMonitorLogs, useListAlerts, useDeleteMonitor, getListMonitorsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid } from 'recharts';
import { format, formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Trash2, Activity, Globe, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Link } from 'wouter';

export function MonitorDetail() {
  const [, params] = useRoute('/monitors/:id');
  const [, setLocation] = useLocation();
  const monitorId = params?.id ? parseInt(params.id, 10) : 0;

  const queryClient = useQueryClient();

  const { data: monitors, isLoading: isLoadingMonitors } = useListMonitors();
  const monitor = monitors?.find((m) => m.id === monitorId);

  const { data: logsData, isLoading: isLoadingLogs } = useListMonitorLogs(
    { monitorId, limit: 100 },
    { query: { enabled: !!monitorId } }
  );

  const { data: alerts, isLoading: isLoadingAlerts } = useListAlerts(
    { monitorId },
    { query: { enabled: !!monitorId } }
  );

  const deleteMonitor = useDeleteMonitor();

  const handleDelete = () => {
    deleteMonitor.mutate(
      { id: monitorId },
      {
        onSuccess: () => {
          toast.success('Monitor deleted');
          queryClient.invalidateQueries({ queryKey: getListMonitorsQueryKey() });
          setLocation('/');
        },
        onError: (err) => {
          toast.error('Failed to delete monitor', { description: err.error });
        }
      }
    );
  };

  if (isLoadingMonitors) {
    return <div className="p-8 space-y-6"><Skeleton className="h-12 w-1/3" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!monitor) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-2xl font-bold">Monitor Not Found</h2>
        <Button onClick={() => setLocation('/')} variant="outline">Back to Dashboard</Button>
      </div>);

  }

  const isUp = monitor.currentStatus === 'UP';
  const isDown = monitor.currentStatus === 'DOWN';

  // Prepare chart data (reverse to show chronological left to right)
  const chartData = [...(logsData?.logs || [])].reverse().map((log) => ({
    time: format(new Date(log.checkedAt), 'HH:mm:ss'),
    ms: log.responseTimeMs || 0,
    status: log.status
  }));

  const recentLogs = logsData?.logs.slice(0, 20) || [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-6xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-2">
          <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-2">
            <ArrowLeft className="h-4 w-4 mr-1" /> Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight truncate">{monitor.name || new URL(monitor.url).hostname}</h1>
            <div className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider",
              isUp ? "bg-[hsl(var(--status-up))]/10 text-[hsl(var(--status-up))] border border-[hsl(var(--status-up))]/20" :
              isDown ? "bg-[hsl(var(--status-down))]/10 text-[hsl(var(--status-down))] border border-[hsl(var(--status-down))]/20 animate-pulse" :
              "bg-muted text-muted-foreground border border-border"
            )}>
              <span className={cn("h-2 w-2 rounded-full", isUp ? "bg-[hsl(var(--status-up))]" : isDown ? "bg-[hsl(var(--status-down))]" : "bg-muted-foreground")} />
              {monitor.currentStatus || 'PENDING'}
            </div>
          </div>
          <p className="text-muted-foreground flex items-center gap-2 font-mono text-sm">
            <Globe className="h-4 w-4" /> {monitor.url}
          </p>
        </div>

        <div className="flex items-center gap-3 self-start">
          <div className="text-right mr-4 hidden sm:block">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Uptime</p>
            <p className="text-xl font-mono font-medium">{monitor.uptimePercent?.toFixed(2) || '0.00'}%</p>
          </div>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Monitor?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the monitor and all its historical logs and alerts.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete Permanently
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border/50 bg-card/50 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Activity className="h-4 w-4" /> Response Time (Last 100 Checks)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingLogs ?
            <Skeleton className="h-[250px] w-full" /> :
            chartData.length === 0 ?
            <div className="h-[250px] flex items-center justify-center text-muted-foreground font-mono text-sm">No data yet</div> :

            <div className="h-[250px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorMs" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis
                    dataKey="time"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={30} />
                  
                    <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value}ms`} />
                  
                    <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--popover-foreground))', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                    itemStyle={{ color: 'hsl(var(--primary))' }} />
                  
                    <Area
                    type="monotone"
                    dataKey="ms"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorMs)"
                    isAnimationActive={false} />
                  
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            }
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-border/50 overflow-hidden flex flex-col h-full max-h-[330px]">
            <CardHeader className="py-4 border-b border-border/50 bg-muted/20">
              <CardTitle className="text-base font-medium text-muted-foreground uppercase tracking-wider">
                Recent Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-auto">
              {isLoadingAlerts ?
              <div className="p-4 space-y-3">
                  <Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" />
                </div> :
              alerts?.length === 0 ?
              <div className="p-8 text-center text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-[hsl(var(--status-up))]/50" />
                  <p className="text-sm">No recent alerts</p>
                </div> :

              <div className="divide-y divide-border/50">
                  {alerts?.slice(0, 10).map((alert) =>
                <div key={alert.id} className="p-4 flex items-start gap-3 hover:bg-muted/30 transition-colors">
                      {alert.eventType === 'DOWN' ? <AlertCircle className="h-4 w-4 text-[hsl(var(--status-down))] mt-0.5 shrink-0" /> :
                  alert.eventType === 'RECOVERED' ? <CheckCircle2 className="h-4 w-4 text-[hsl(var(--status-up))] mt-0.5 shrink-0" /> :
                  <Clock className="h-4 w-4 text-[hsl(var(--status-latency))] mt-0.5 shrink-0" />}
                      <div className="space-y-1 min-w-0">
                        <p className="text-sm font-medium leading-none">{alert.eventType.replace('_', ' ')}</p>
                        <p className="text-xs text-muted-foreground truncate">{alert.message}</p>
                        <p className="text-[10px] text-muted-foreground font-mono mt-1">{formatDistanceToNow(new Date(alert.triggeredAt), { addSuffix: true })}</p>
                      </div>
                    </div>
                )}
                </div>
              }
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="border-border/50 overflow-hidden">
        <CardHeader className="py-4 border-b border-border/50 bg-muted/20">
          <CardTitle className="text-base font-medium text-muted-foreground uppercase tracking-wider">
            Check History (Last 20)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Response Time</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingLogs ?
              <TableRow><TableCell colSpan={5}><Skeleton className="h-8 w-full my-2" /></TableCell></TableRow> :
              recentLogs.length === 0 ?
              <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No checks performed yet.</TableCell>
                </TableRow> :

              recentLogs.map((log) =>
              <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs whitespace-nowrap text-muted-foreground">
                      {format(new Date(log.checkedAt), 'MMM d, HH:mm:ss')}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(
                    "font-mono uppercase text-[10px]",
                    log.status === 'UP' ? "text-[hsl(var(--status-up))] border-[hsl(var(--status-up))]/30" : "text-[hsl(var(--status-down))] border-[hsl(var(--status-down))]/30"
                  )}>
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {log.responseTimeMs ? `${log.responseTimeMs}ms` : '-'}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {log.statusCode || '-'}
                    </TableCell>
                    <TableCell className="text-sm max-w-md truncate text-muted-foreground">
                      {log.errorMessage || '-'}
                    </TableCell>
                  </TableRow>
              )
              }
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>);

}