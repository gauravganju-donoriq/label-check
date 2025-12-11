import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Plus, Edit, Trash2, ExternalLink, Loader2, Globe } from 'lucide-react';
import { format } from 'date-fns';

interface State {
  id: string;
  name: string;
  abbreviation: string;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface RegulatorySource {
  id: string;
  state_id: string;
  source_name: string;
  source_url: string;
  last_checked: string | null;
  last_content_change: string | null;
  check_frequency_days: number;
  is_active: boolean;
}

export default function ManageStates() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [states, setStates] = useState<State[]>([]);
  const [sources, setSources] = useState<RegulatorySource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedState, setSelectedState] = useState<State | null>(null);
  const [showStateDialog, setShowStateDialog] = useState(false);
  const [showSourceDialog, setShowSourceDialog] = useState(false);
  const [stateForm, setStateForm] = useState({ name: '', abbreviation: '', is_enabled: true });
  const [sourceForm, setSourceForm] = useState({ source_name: '', source_url: '', check_frequency_days: 7, is_active: true });
  const [editingSource, setEditingSource] = useState<RegulatorySource | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchStates();
    fetchSources();
  }, []);

  async function fetchStates() {
    const { data, error } = await supabase
      .from('states')
      .select('*')
      .order('name');
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setStates(data || []);
    }
    setIsLoading(false);
  }

  async function fetchSources() {
    const { data, error } = await supabase
      .from('regulatory_sources')
      .select('*')
      .order('source_name');
    if (error) {
      console.error('Error fetching sources:', error);
    } else {
      setSources(data || []);
    }
  }

  async function toggleStateEnabled(state: State) {
    const { error } = await supabase
      .from('states')
      .update({ is_enabled: !state.is_enabled })
      .eq('id', state.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Updated', description: `${state.name} is now ${!state.is_enabled ? 'enabled' : 'disabled'}` });
      fetchStates();
    }
  }

  async function saveState() {
    setIsSaving(true);
    try {
      if (selectedState) {
        const { error } = await supabase
          .from('states')
          .update({
            name: stateForm.name,
            abbreviation: stateForm.abbreviation.toUpperCase(),
            is_enabled: stateForm.is_enabled
          })
          .eq('id', selectedState.id);

        if (error) throw error;
        toast({ title: 'Updated', description: 'State updated successfully' });
      } else {
        const { error } = await supabase
          .from('states')
          .insert({
            name: stateForm.name,
            abbreviation: stateForm.abbreviation.toUpperCase(),
            is_enabled: stateForm.is_enabled
          });

        if (error) throw error;
        toast({ title: 'Created', description: 'State created successfully' });
      }
      setShowStateDialog(false);
      setSelectedState(null);
      setStateForm({ name: '', abbreviation: '', is_enabled: true });
      fetchStates();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save state',
        variant: 'destructive'
      });
    }
    setIsSaving(false);
  }

  async function saveSource() {
    if (!selectedState) return;
    setIsSaving(true);
    try {
      if (editingSource) {
        const { error } = await supabase
          .from('regulatory_sources')
          .update({
            source_name: sourceForm.source_name,
            source_url: sourceForm.source_url,
            check_frequency_days: sourceForm.check_frequency_days,
            is_active: sourceForm.is_active
          })
          .eq('id', editingSource.id);

        if (error) throw error;
        toast({ title: 'Updated', description: 'Regulatory source updated' });
      } else {
        const { error } = await supabase
          .from('regulatory_sources')
          .insert({
            state_id: selectedState.id,
            source_name: sourceForm.source_name,
            source_url: sourceForm.source_url,
            check_frequency_days: sourceForm.check_frequency_days,
            is_active: sourceForm.is_active
          });

        if (error) throw error;
        toast({ title: 'Created', description: 'Regulatory source added' });
      }
      setShowSourceDialog(false);
      setEditingSource(null);
      setSourceForm({ source_name: '', source_url: '', check_frequency_days: 7, is_active: true });
      fetchSources();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save source',
        variant: 'destructive'
      });
    }
    setIsSaving(false);
  }

  async function deleteSource(source: RegulatorySource) {
    if (!confirm('Are you sure you want to delete this regulatory source?')) return;

    const { error } = await supabase
      .from('regulatory_sources')
      .delete()
      .eq('id', source.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Deleted', description: 'Regulatory source deleted' });
      fetchSources();
    }
  }

  function openEditState(state: State) {
    setSelectedState(state);
    setStateForm({
      name: state.name,
      abbreviation: state.abbreviation,
      is_enabled: state.is_enabled
    });
    setShowStateDialog(true);
  }

  function openAddSource(state: State) {
    setSelectedState(state);
    setEditingSource(null);
    setSourceForm({ source_name: '', source_url: '', check_frequency_days: 7, is_active: true });
    setShowSourceDialog(true);
  }

  function openEditSource(source: RegulatorySource) {
    const state = states.find(s => s.id === source.state_id);
    if (state) {
      setSelectedState(state);
      setEditingSource(source);
      setSourceForm({
        source_name: source.source_name,
        source_url: source.source_url,
        check_frequency_days: source.check_frequency_days,
        is_active: source.is_active
      });
      setShowSourceDialog(true);
    }
  }

  function getStateSources(stateId: string) {
    return sources.filter(s => s.state_id === stateId);
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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold">Manage States</h1>
            <p className="text-muted-foreground">Configure states and their regulatory sources</p>
          </div>
          <Button onClick={() => { setSelectedState(null); setStateForm({ name: '', abbreviation: '', is_enabled: true }); setShowStateDialog(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Add State
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {states.map(state => (
              <Card key={state.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-lg">{state.name}</CardTitle>
                      <Badge variant="outline">{state.abbreviation}</Badge>
                      <Badge variant={state.is_enabled ? 'default' : 'secondary'}>
                        {state.is_enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={state.is_enabled}
                        onCheckedChange={() => toggleStateEnabled(state)}
                      />
                      <Button variant="ghost" size="sm" onClick={() => openEditState(state)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openAddSource(state)}>
                        <Globe className="w-4 h-4 mr-1" /> Add Source
                      </Button>
                    </div>
                  </div>
                  <CardDescription>
                    {getStateSources(state.id).length} regulatory source(s) configured
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {getStateSources(state.id).length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Source Name</TableHead>
                          <TableHead>URL</TableHead>
                          <TableHead>Check Frequency</TableHead>
                          <TableHead>Last Checked</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getStateSources(state.id).map(source => (
                          <TableRow key={source.id}>
                            <TableCell className="font-medium">{source.source_name}</TableCell>
                            <TableCell>
                              <a href={source.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                                Visit <ExternalLink className="w-3 h-3" />
                              </a>
                            </TableCell>
                            <TableCell className="text-muted-foreground">Every {source.check_frequency_days} days</TableCell>
                            <TableCell className="text-muted-foreground">
                              {source.last_checked
                                ? format(new Date(source.last_checked), 'MMM d, yyyy HH:mm')
                                : 'Never'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={source.is_active ? 'default' : 'secondary'}>
                                {source.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" onClick={() => openEditSource(source)}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => deleteSource(source)}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* State Dialog */}
      <Dialog open={showStateDialog} onOpenChange={setShowStateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedState ? 'Edit State' : 'Add New State'}</DialogTitle>
            <DialogDescription>
              {selectedState ? 'Update state information' : 'Add a new state for compliance tracking'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>State Name</Label>
              <Input
                value={stateForm.name}
                onChange={(e) => setStateForm({ ...stateForm, name: e.target.value })}
                placeholder="e.g., Oregon"
              />
            </div>
            <div className="space-y-2">
              <Label>Abbreviation</Label>
              <Input
                value={stateForm.abbreviation}
                onChange={(e) => setStateForm({ ...stateForm, abbreviation: e.target.value.toUpperCase() })}
                placeholder="e.g., OR"
                maxLength={2}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={stateForm.is_enabled}
                onCheckedChange={(checked) => setStateForm({ ...stateForm, is_enabled: checked })}
              />
              <Label>Enabled for compliance checks</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStateDialog(false)}>Cancel</Button>
            <Button onClick={saveState} disabled={isSaving || !stateForm.name || !stateForm.abbreviation}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {selectedState ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Source Dialog */}
      <Dialog open={showSourceDialog} onOpenChange={setShowSourceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSource ? 'Edit Regulatory Source' : 'Add Regulatory Source'}</DialogTitle>
            <DialogDescription>
              Configure a regulatory source for {selectedState?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Source Name</Label>
              <Input
                value={sourceForm.source_name}
                onChange={(e) => setSourceForm({ ...sourceForm, source_name: e.target.value })}
                placeholder="e.g., Oregon OLCC Regulations"
              />
            </div>
            <div className="space-y-2">
              <Label>Source URL</Label>
              <Input
                value={sourceForm.source_url}
                onChange={(e) => setSourceForm({ ...sourceForm, source_url: e.target.value })}
                placeholder="https://example.gov/regulations"
              />
            </div>
            <div className="space-y-2">
              <Label>Check Frequency (days)</Label>
              <Input
                type="number"
                value={sourceForm.check_frequency_days}
                onChange={(e) => setSourceForm({ ...sourceForm, check_frequency_days: parseInt(e.target.value) || 7 })}
                min={1}
                max={30}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={sourceForm.is_active}
                onCheckedChange={(checked) => setSourceForm({ ...sourceForm, is_active: checked })}
              />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSourceDialog(false)}>Cancel</Button>
            <Button onClick={saveSource} disabled={isSaving || !sourceForm.source_name || !sourceForm.source_url}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingSource ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
