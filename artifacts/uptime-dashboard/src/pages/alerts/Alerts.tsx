import { useState } from 'react';
import { useListAlerts } from '@workspace/api-client-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { AlertCircle, CheckCircle2, Clock, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export function Alerts() {
  const [filter, setFilter] = useState<'all' | 'unresolved'>('unresolved');
  
  const { data: alerts, isLoading, isError } = useListAlerts({ 
    resolved: filter === 'unresolved' ? false : undefined 
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Alerts</h1>
          <p className="text-muted-foreground mt-1">Incident history across all your monitors.</p>
        </div>
        
        <ToggleGroup type="single" value={filter} onValueChange={(v) => v && setFilter(v as any)} className="justify-start">
          <ToggleGroupItem value="all" className="text-xs">All Events</ToggleGroupItem>
          <ToggleGroupItem value="unresolved" className="text-xs">Unresolved</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <Card className="border-border/50 overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[180px]">Status</TableHead>
                <TableHead>Monitor</TableHead>
                <TableHead>Message</TableHead>
                <TableHead className="text-right">Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-64" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-6 w-32 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-destructive">
                    Failed to load alerts
                  </TableCell>
                </TableRow>
              ) : alerts?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-48 text-center text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-3 text-[hsl(var(--status-up))]/50" />
                    <p>No {filter === 'unresolved' ? 'unresolved' : ''} alerts found.</p>
                    <p className="text-xs mt-1">Everything is looking good.</p>
                  </TableCell>
                </TableRow>
              ) : (
                alerts?.map((alert) => (
                  <TableRow key={alert.id} className={cn(!alert.resolved && "bg-[hsl(var(--status-down))]/5")}>
                    <TableCell>
                      <Badge variant="outline" className={cn(
                        "font-mono uppercase text-[10px]",
                        alert.eventType === 'DOWN' ? "text-[hsl(var(--status-down))] border-[hsl(var(--status-down))]/30 bg-[hsl(var(--status-down))]/10" :
                        alert.eventType === 'RECOVERED' ? "text-[hsl(var(--status-up))] border-[hsl(var(--status-up))]/30 bg-[hsl(var(--status-up))]/10" :
                        alert.eventType === 'HIGH_LATENCY' ? "text-[hsl(var(--status-latency))] border-[hsl(var(--status-latency))]/30 bg-[hsl(var(--status-latency))]/10" : ""
                      )}>
                        {alert.eventType === 'DOWN' && <AlertCircle className="h-3 w-3 mr-1 inline-block" />}
                        {alert.eventType === 'RECOVERED' && <CheckCircle2 className="h-3 w-3 mr-1 inline-block" />}
                        {alert.eventType === 'HIGH_LATENCY' && <Clock className="h-3 w-3 mr-1 inline-block" />}
                        {alert.eventType.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{alert.monitorName || new URL(alert.monitorUrl || 'https://unknown').hostname}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                          <Globe className="h-3 w-3" />
                          {alert.monitorUrl}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {alert.message || '-'}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap text-sm font-mono text-muted-foreground">
                      {format(new Date(alert.triggeredAt), 'MMM d, HH:mm:ss')}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
