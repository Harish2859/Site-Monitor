import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useCreateMonitor, getListMonitorsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const intervals = [
  { value: '30', label: '30 seconds' },
  { value: '60', label: '1 minute' },
  { value: '300', label: '5 minutes' },
  { value: '900', label: '15 minutes' },
  { value: '1800', label: '30 minutes' },
  { value: '3600', label: '1 hour' },
];

const formSchema = z.object({
  url: z.string().url('Please enter a valid URL (e.g. https://example.com)'),
  name: z.string().optional(),
  intervalSeconds: z.coerce.number().min(30, 'Minimum interval is 30 seconds'),
});

export function AddMonitorModal() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const createMonitor = useCreateMonitor();
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      url: 'https://',
      name: '',
      intervalSeconds: 60,
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createMonitor.mutate(
      { data: values },
      {
        onSuccess: () => {
          toast.success('Monitor created successfully');
          queryClient.invalidateQueries({ queryKey: getListMonitorsQueryKey() });
          setOpen(false);
          form.reset();
        },
        onError: (error) => {
          toast.error('Failed to create monitor', {
            description: error.error || 'Unknown error occurred',
          });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 50 }}>
        <DialogTrigger asChild>
          <Button size="lg" className="h-14 w-14 rounded-full shadow-lg px-0 flex items-center justify-center">
            <Plus className="h-6 w-6" />
          </Button>
        </DialogTrigger>
      </div>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Monitor</DialogTitle>
          <DialogDescription>
            Configure a new endpoint to monitor. We'll start checking it immediately.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL to Monitor</FormLabel>
                  <FormControl>
                    <Input placeholder="https://api.example.com/health" {...field} className="font-mono text-sm" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Friendly Name (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Production API" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="intervalSeconds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Check Interval</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={String(field.value)}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an interval" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {intervals.map((i) => (
                        <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMonitor.isPending}>
                {createMonitor.isPending ? 'Creating...' : 'Add Monitor'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
