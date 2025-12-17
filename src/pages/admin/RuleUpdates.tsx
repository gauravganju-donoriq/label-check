import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, Check, X, AlertCircle, Clock, Loader2, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { CitationLink } from '@/components/CitationLink';

interface State {
  id: string;
  name: string;
  abbreviation: string;
}

interface RuleSuggestion {
  id: string;
  state_id: string;
  source_id: string | null;
  existing_rule_id: string | null;
  change_type: 'new' | 'update' | 'deprecate' | 'add' | 'remove';
  suggested_name: string;
  suggested_description: string;
  suggested_category: string | null;
  suggested_severity: string | null;
  suggested_validation_prompt: string | null;
  suggested_citation: string | null;
  suggested_source_url: string | null;
  ai_reasoning: string | null;
  source_excerpt: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  states?: State;
  existing_rule?: {
    name: string;
    description: string;
    category: string;
    severity: string;
  };
}

export default function RuleUpdates() {
  const { isAdmin, user } = useAuth();
  const { toast } = useToast();
  const [states, setStates] = useState<State[]>([]);
  const [selectedState, setSelectedState] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [suggestions, setSuggestions] = useState<RuleSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<RuleSuggestion | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchStates();
    fetchSuggestions();
  }, [selectedState, statusFilter]);

  async function fetchStates() {
    const { data } = await supabase
      .from('states')
      .select('id, name, abbreviation')
      .eq('is_enabled', true)
      .order('name');
    if (data) setStates(data);
  }

  async function fetchSuggestions() {
    setIsLoading(true);
    let query = supabase
      .from('rule_change_suggestions')
      .select(`*, states (id, name, abbreviation)`)
      .order('created_at', { ascending: false });

    if (selectedState !== 'all') {
      query = query.eq('state_id', selectedState);
    }
    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      const suggestionsWithRules = await Promise.all(
        (data || []).map(async (s) => {
          if (s.existing_rule_id) {
            const { data: rule } = await supabase
              .from('compliance_rules')
              .select('name, description, category, severity')
              .eq('id', s.existing_rule_id)
              .single();
            return { ...s, existing_rule: rule };
          }
          return s;
        })
      );
      setSuggestions(suggestionsWithRules as RuleSuggestion[]);
    }
    setIsLoading(false);
  }

  async function runRegulationCheck() {
    setIsChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-regulations', {
        body: selectedState !== 'all' ? { state_id: selectedState } : {}
      });

      if (error) throw error;

      toast({
        title: 'Regulation Check Complete',
        description: `Checked ${data.sources_checked} sources. Created ${data.results?.reduce((sum: number, r: { suggestions_created: number }) => sum + r.suggestions_created, 0) || 0} new suggestions.`
      });
      fetchSuggestions();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to check regulations',
        variant: 'destructive'
      });
    }
    setIsChecking(false);
  }

  async function handleApprove(suggestion: RuleSuggestion) {
    setIsProcessing(true);
    try {
      if (suggestion.change_type === 'new' || suggestion.change_type === 'add') {
        const { data: newRule, error: createError } = await supabase
          .from('compliance_rules')
          .insert({
            state_id: suggestion.state_id,
            name: suggestion.suggested_name,
            description: suggestion.suggested_description,
            category: suggestion.suggested_category || 'General',
            severity: (suggestion.suggested_severity as 'error' | 'warning' | 'info') || 'warning',
            citation: suggestion.suggested_citation,
            source_url: suggestion.suggested_source_url,
            validation_prompt: suggestion.suggested_validation_prompt || suggestion.suggested_description,
            is_active: true
          })
          .select()
          .single();

        if (createError) throw createError;

        await supabase.from('rule_audit_log').insert({
          rule_id: newRule.id,
          state_id: suggestion.state_id,
          action: 'created',
          changed_by: user?.id,
          change_reason: reviewNotes || 'Approved from AI suggestion',
          new_version: newRule,
          suggestion_id: suggestion.id
        });

      } else if (suggestion.change_type === 'update' && suggestion.existing_rule_id) {
        const { data: currentRule } = await supabase
          .from('compliance_rules')
          .select('*')
          .eq('id', suggestion.existing_rule_id)
          .single();

        const { data: updatedRule, error: updateError } = await supabase
          .from('compliance_rules')
          .update({
            name: suggestion.suggested_name,
            description: suggestion.suggested_description,
            category: suggestion.suggested_category || currentRule?.category,
            severity: (suggestion.suggested_severity as 'error' | 'warning' | 'info') || currentRule?.severity,
            citation: suggestion.suggested_citation || currentRule?.citation,
            validation_prompt: suggestion.suggested_validation_prompt || currentRule?.validation_prompt,
            version: (currentRule?.version || 1) + 1
          })
          .eq('id', suggestion.existing_rule_id)
          .select()
          .single();

        if (updateError) throw updateError;

        await supabase.from('rule_audit_log').insert({
          rule_id: suggestion.existing_rule_id,
          state_id: suggestion.state_id,
          action: 'updated',
          changed_by: user?.id,
          change_reason: reviewNotes || 'Approved from AI suggestion',
          previous_version: currentRule,
          new_version: updatedRule,
          suggestion_id: suggestion.id
        });

      } else if (suggestion.change_type === 'deprecate' && suggestion.existing_rule_id) {
        const { data: currentRule } = await supabase
          .from('compliance_rules')
          .select('*')
          .eq('id', suggestion.existing_rule_id)
          .single();

        const { error: deactivateError } = await supabase
          .from('compliance_rules')
          .update({ is_active: false })
          .eq('id', suggestion.existing_rule_id);

        if (deactivateError) throw deactivateError;

        await supabase.from('rule_audit_log').insert({
          rule_id: suggestion.existing_rule_id,
          state_id: suggestion.state_id,
          action: 'deactivated',
          changed_by: user?.id,
          change_reason: reviewNotes || suggestion.ai_reasoning || 'Deprecated from AI suggestion',
          previous_version: currentRule,
          suggestion_id: suggestion.id
        });
      }

      await supabase
        .from('rule_change_suggestions')
        .update({
          status: 'approved',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes
        })
        .eq('id', suggestion.id);

      toast({ title: 'Approved', description: `Successfully ${suggestion.change_type === 'new' ? 'created' : suggestion.change_type === 'update' ? 'updated' : 'deprecated'} the rule.` });
      setSelectedSuggestion(null);
      setReviewNotes('');
      fetchSuggestions();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to approve suggestion',
        variant: 'destructive'
      });
    }
    setIsProcessing(false);
  }

  async function handleReject(suggestion: RuleSuggestion) {
    setIsProcessing(true);
    try {
      await supabase
        .from('rule_change_suggestions')
        .update({
          status: 'rejected',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes
        })
        .eq('id', suggestion.id);

      toast({ title: 'Rejected', description: 'Suggestion has been rejected.' });
      setSelectedSuggestion(null);
      setReviewNotes('');
      fetchSuggestions();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to reject suggestion',
        variant: 'destructive'
      });
    }
    setIsProcessing(false);
  }

  function getChangeTypeBadge(type: string) {
    switch (type) {
      case 'new':
      case 'add':
        return <Badge className="bg-chart-2">New Rule</Badge>;
      case 'update':
        return <Badge className="bg-blue-500">Update</Badge>;
      case 'deprecate':
      case 'remove':
        return <Badge variant="destructive">Remove</Badge>;
      default:
        return <Badge>{type}</Badge>;
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="border-chart-4 text-chart-4"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge className="bg-chart-2"><Check className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><X className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Rule Update Suggestions</h1>
            <p className="text-muted-foreground">Review AI-detected regulatory changes</p>
          </div>
          <Button onClick={runRegulationCheck} disabled={isChecking}>
            {isChecking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Check for Updates
          </Button>
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

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : suggestions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="w-10 h-10 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">No suggestions found matching your filters.</p>
              <Button variant="outline" className="mt-4" onClick={runRegulationCheck} disabled={isChecking}>
                Run Regulation Check
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {suggestions.map(suggestion => (
              <Card key={suggestion.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getChangeTypeBadge(suggestion.change_type)}
                        {getStatusBadge(suggestion.status)}
                        <Badge variant="outline">{suggestion.states?.abbreviation}</Badge>
                      </div>
                      <CardTitle className="text-base">{suggestion.suggested_name}</CardTitle>
                      <CardDescription className="text-sm">{suggestion.suggested_description}</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setSelectedSuggestion(suggestion)}>
                      <Eye className="w-4 h-4 mr-1" /> Review
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs">Category</span>
                      <p className="font-medium">{suggestion.suggested_category || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Severity</span>
                      <p className="font-medium capitalize">{suggestion.suggested_severity || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Citation</span>
                      <p className="font-medium">
                        <CitationLink 
                          citation={suggestion.suggested_citation} 
                          stateAbbreviation={suggestion.states?.abbreviation || ''} 
                          sourceUrl={suggestion.suggested_source_url}
                          showVerificationBadge={true}
                        />
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Created</span>
                      <p className="font-medium">{format(new Date(suggestion.created_at), 'MMM d, yyyy')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Review Dialog */}
      <Dialog open={!!selectedSuggestion} onOpenChange={() => { setSelectedSuggestion(null); setReviewNotes(''); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Review Suggestion
              {selectedSuggestion && getChangeTypeBadge(selectedSuggestion.change_type)}
            </DialogTitle>
            <DialogDescription>
              Review this AI-generated suggestion and approve or reject it.
            </DialogDescription>
          </DialogHeader>

          {selectedSuggestion && (
            <div className="space-y-4">
              {selectedSuggestion.change_type !== 'new' && selectedSuggestion.existing_rule && (
                <Card className="bg-muted/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Current Rule</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <p><span className="text-muted-foreground">Name:</span> {selectedSuggestion.existing_rule.name}</p>
                    <p><span className="text-muted-foreground">Description:</span> {selectedSuggestion.existing_rule.description}</p>
                    <p><span className="text-muted-foreground">Category:</span> {selectedSuggestion.existing_rule.category}</p>
                    <p><span className="text-muted-foreground">Severity:</span> {selectedSuggestion.existing_rule.severity}</p>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Suggested Changes</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p><span className="text-muted-foreground">Name:</span> {selectedSuggestion.suggested_name}</p>
                  <p><span className="text-muted-foreground">Description:</span> {selectedSuggestion.suggested_description}</p>
                  <p><span className="text-muted-foreground">Category:</span> {selectedSuggestion.suggested_category || 'N/A'}</p>
                  <p><span className="text-muted-foreground">Severity:</span> {selectedSuggestion.suggested_severity || 'N/A'}</p>
                  <p>
                    <span className="text-muted-foreground">Citation:</span>{' '}
                    <CitationLink 
                      citation={selectedSuggestion.suggested_citation} 
                      stateAbbreviation={selectedSuggestion.states?.abbreviation || ''} 
                      sourceUrl={selectedSuggestion.suggested_source_url}
                      showVerificationBadge={true}
                    />
                  </p>
                  {!selectedSuggestion.suggested_source_url && selectedSuggestion.status === 'pending' && (
                    <p className="text-xs text-chart-4 mt-2 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Warning: No verified source URL. Consider rejecting or manually verifying.
                    </p>
                  )}
                </CardContent>
              </Card>

              {selectedSuggestion.ai_reasoning && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">AI Reasoning</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{selectedSuggestion.ai_reasoning}</p>
                  </CardContent>
                </Card>
              )}

              {selectedSuggestion.source_excerpt && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Source Excerpt</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground italic">"{selectedSuggestion.source_excerpt}"</p>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-2">
                <Label>Review Notes (Optional)</Label>
                <Textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add any notes about your decision..."
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setSelectedSuggestion(null); setReviewNotes(''); }}>
              Cancel
            </Button>
            {selectedSuggestion?.status === 'pending' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => selectedSuggestion && handleReject(selectedSuggestion)}
                  disabled={isProcessing}
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <X className="w-4 h-4 mr-2" />}
                  Reject
                </Button>
                <Button
                  onClick={() => selectedSuggestion && handleApprove(selectedSuggestion)}
                  disabled={isProcessing}
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                  Approve
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
