import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Loader2, Eye, History, Plus, RefreshCw, Trash, Power } from 'lucide-react';
import { format } from 'date-fns';

interface State {
  id: string;
  name: string;
  abbreviation: string;
}

interface AuditLogEntry {
  id: string;
  rule_id: string | null;
  state_id: string | null;
  action: 'created' | 'updated' | 'deactivated' | 'reactivated' | 'deleted';
  changed_by: string | null;
  change_reason: string | null;
  previous_version: Record<string, unknown> | null;
  new_version: Record<string, unknown> | null;
  suggestion_id: string | null;
  created_at: string;
  states?: State;
}

export default function AuditLog() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [states, setStates] = useState<State[]>([]);
  const [selectedState, setSelectedState] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  useEffect(() => {
    fetchStates();
    fetchLogs();
  }, [selectedState, actionFilter]);

  async function fetchStates() {
    const { data } = await supabase
      .from('states')
      .select('id, name, abbreviation')
      .order('name');
    if (data) setStates(data);
  }

  async function fetchLogs() {
    setIsLoading(true);
    let query = supabase
      .from('rule_audit_log')
      .select(`*, states (id, name, abbreviation)`)
      .order('created_at', { ascending: false })
      .limit(100);

    if (selectedState !== 'all') {
      query = query.eq('state_id', selectedState);
    }
    if (actionFilter !== 'all') {
      query = query.eq('action', actionFilter);
    }

    const { data, error } = await query;
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setLogs(data as AuditLogEntry[] || []);
    }
    setIsLoading(false);
  }

  function getActionIcon(action: string) {
    switch (action) {
      case 'created':
        return <Plus className="w-4 h-4 text-chart-2" />;
      case 'updated':
        return <RefreshCw className="w-4 h-4 text-blue-500" />;
      case 'deactivated':
        return <Power className="w-4 h-4 text-chart-4" />;
      case 'reactivated':
        return <Power className="w-4 h-4 text-chart-2" />;
      case 'deleted':
        return <Trash className="w-4 h-4 text-destructive" />;
      default:
        return <History className="w-4 h-4" />;
    }
  }

  function getActionBadge(action: string) {
    switch (action) {
      case 'created':
        return <Badge className="bg-chart-2">Created</Badge>;
      case 'updated':
        return <Badge className="bg-blue-500">Updated</Badge>;
      case 'deactivated':
        return <Badge className="bg-chart-4">Deactivated</Badge>;
      case 'reactivated':
        return <Badge className="bg-chart-2">Reactivated</Badge>;
      case 'deleted':
        return <Badge variant="destructive">Deleted</Badge>;
      default:
        return <Badge>{action}</Badge>;
    }
  }

  function getRuleName(log: AuditLogEntry): string {
    if (log.new_version && typeof log.new_version === 'object' && 'name' in log.new_version) {
      return log.new_version.name as string;
    }
    if (log.previous_version && typeof log.previous_version === 'object' && 'name' in log.previous_version) {
      return log.previous_version.name as string;
    }
    return 'Unknown Rule';
  }

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <Card className="p-6 text-center">
            <AlertCircle className="w-10 h-10 text-destructive/70 mx-auto mb-4" />
            <p className="text-muted-foreground">Access denied. Admin privileges required.</p>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Rule Audit Log</h1>
          <p className="text-muted-foreground">Complete history of all rule changes</p>
        </div>

        <div className="flex gap-3">
          <Select value={selectedState} onValueChange={setSelectedState}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Filter by state" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All States</SelectItem>
              {states.map(state => (
                <SelectItem key={state.id} value={state.id}>{state.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Filter by action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="created">Created</SelectItem>
              <SelectItem value="updated">Updated</SelectItem>
              <SelectItem value="deactivated">Deactivated</SelectItem>
              <SelectItem value="reactivated">Reactivated</SelectItem>
              <SelectItem value="deleted">Deleted</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <History className="w-10 h-10 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">No audit log entries found.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {logs.map(log => (
              <Card key={log.id} className="hover:bg-accent/30 transition-colors">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {getActionIcon(log.action)}
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {getActionBadge(log.action)}
                          <span className="font-medium text-sm">{getRuleName(log)}</span>
                          {log.states && (
                            <Badge variant="outline">{log.states.abbreviation}</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {log.change_reason || 'No reason provided'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(log.created_at), 'MMM d, yyyy HH:mm')}
                      </span>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Audit Log Details
              {selectedLog && getActionBadge(selectedLog.action)}
            </DialogTitle>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs">Rule</span>
                  <p className="font-medium">{getRuleName(selectedLog)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">State</span>
                  <p className="font-medium">{selectedLog.states?.name || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Timestamp</span>
                  <p className="font-medium">{format(new Date(selectedLog.created_at), 'MMMM d, yyyy HH:mm:ss')}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">From Suggestion</span>
                  <p className="font-medium">{selectedLog.suggestion_id ? 'Yes' : 'No'}</p>
                </div>
              </div>

              {selectedLog.change_reason && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Change Reason</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{selectedLog.change_reason}</p>
                  </CardContent>
                </Card>
              )}

              {selectedLog.action === 'updated' && selectedLog.previous_version && selectedLog.new_version && (
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Previous Version</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-64">
                        {JSON.stringify(selectedLog.previous_version, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">New Version</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-64">
                        {JSON.stringify(selectedLog.new_version, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>
                </div>
              )}

              {selectedLog.action === 'created' && selectedLog.new_version && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Created Rule</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-64">
                      {JSON.stringify(selectedLog.new_version, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}

              {(selectedLog.action === 'deactivated' || selectedLog.action === 'deleted') && selectedLog.previous_version && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Removed Rule</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-64">
                      {JSON.stringify(selectedLog.previous_version, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
