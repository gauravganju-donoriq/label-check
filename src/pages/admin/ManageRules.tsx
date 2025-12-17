import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  State,
  ComplianceRule,
  ComplianceSeverity,
  ProductType,
  RuleSourceType,
  PRODUCT_TYPE_LABELS,
  RULE_CATEGORIES,
} from '@/types/compliance';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  AlertCircle,
  Info,
  Loader2,
  Globe,
  User,
} from 'lucide-react';
import { CitationLink } from '@/components/CitationLink';

export default function ManageRules() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  
  const [states, setStates] = useState<State[]>([]);
  const [rules, setRules] = useState<ComplianceRule[]>([]);
  const [selectedState, setSelectedState] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ComplianceRule | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    severity: 'error' as ComplianceSeverity,
    citation: '',
    source_url: '',
    validation_prompt: '',
    product_types: Object.keys(PRODUCT_TYPE_LABELS) as ProductType[],
    is_active: true,
    source_type: 'regulatory' as RuleSourceType,
  });

  useEffect(() => {
    fetchStates();
  }, []);

  useEffect(() => {
    if (selectedState) {
      fetchRules();
    }
  }, [selectedState]);

  const fetchStates = async () => {
    const { data, error } = await supabase.from('states').select('*');
    if (!error && data) {
      setStates(data as State[]);
      if (data.length > 0) {
        setSelectedState(data[0].id);
      }
    }
    setIsLoading(false);
  };

  const fetchRules = async () => {
    const { data, error } = await supabase
      .from('compliance_rules')
      .select('*')
      .eq('state_id', selectedState)
      .order('category', { ascending: true });
    
    if (!error && data) {
      setRules(data as ComplianceRule[]);
    }
  };

  const openCreateDialog = () => {
    setEditingRule(null);
    setFormData({
      name: '',
      description: '',
      category: '',
      severity: 'error',
      citation: '',
      source_url: '',
      validation_prompt: '',
      product_types: Object.keys(PRODUCT_TYPE_LABELS) as ProductType[],
      is_active: true,
      source_type: 'regulatory',
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (rule: ComplianceRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description,
      category: rule.category,
      severity: rule.severity,
      citation: rule.citation || '',
      source_url: rule.source_url || '',
      validation_prompt: rule.validation_prompt,
      product_types: rule.product_types,
      is_active: rule.is_active,
      source_type: rule.source_type || 'regulatory',
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.description || !formData.category || !formData.validation_prompt) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please fill in all required fields.',
      });
      return;
    }

    // Regulatory rules require citation and source URL
    if (formData.source_type === 'regulatory' && (!formData.citation || !formData.source_url)) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Regulatory rules require a citation and source URL.',
      });
      return;
    }

    setIsSaving(true);

    try {
      if (editingRule) {
        const { error } = await supabase
          .from('compliance_rules')
          .update({
            name: formData.name,
            description: formData.description,
            category: formData.category,
            severity: formData.severity,
            citation: formData.source_type === 'internal' ? null : (formData.citation || null),
            source_url: formData.source_type === 'internal' ? null : (formData.source_url || null),
            validation_prompt: formData.validation_prompt,
            product_types: formData.product_types,
            is_active: formData.is_active,
            source_type: formData.source_type,
            version: editingRule.version + 1,
          })
          .eq('id', editingRule.id);

        if (error) throw error;
        toast({ title: 'Rule updated successfully' });
      } else {
        const { error } = await supabase.from('compliance_rules').insert({
          state_id: selectedState,
          name: formData.name,
          description: formData.description,
          category: formData.category,
          severity: formData.severity,
          citation: formData.source_type === 'internal' ? null : (formData.citation || null),
          source_url: formData.source_type === 'internal' ? null : (formData.source_url || null),
          validation_prompt: formData.validation_prompt,
          product_types: formData.product_types,
          is_active: formData.is_active,
          source_type: formData.source_type,
        });

        if (error) throw error;
        toast({ title: 'Rule created successfully' });
      }

      setIsDialogOpen(false);
      fetchRules();
    } catch (error) {
      console.error('Error saving rule:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save rule. Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;

    try {
      const { error } = await supabase.from('compliance_rules').delete().eq('id', ruleId);
      if (error) throw error;
      toast({ title: 'Rule deleted successfully' });
      fetchRules();
    } catch (error) {
      console.error('Error deleting rule:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete rule.',
      });
    }
  };

  const toggleRuleActive = async (rule: ComplianceRule) => {
    try {
      const { error } = await supabase
        .from('compliance_rules')
        .update({ is_active: !rule.is_active })
        .eq('id', rule.id);
      
      if (error) throw error;
      fetchRules();
    } catch (error) {
      console.error('Error toggling rule:', error);
    }
  };

  const getSeverityIcon = (severity: ComplianceSeverity) => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-chart-4" />;
      case 'info':
        return <Info className="w-4 h-4 text-chart-1" />;
    }
  };

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="p-6 lg:p-8 text-center">
          <AlertTriangle className="w-10 h-10 mx-auto text-destructive/70 mb-4" />
          <p className="text-lg font-medium mb-2">Access Denied</p>
          <p className="text-muted-foreground">You need admin privileges to access this page.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold">Manage Compliance Rules</h1>
            <p className="text-muted-foreground mt-1">
              Create and manage state-specific compliance rules
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle className="text-lg">Compliance Rules</CardTitle>
                <CardDescription>
                  Rules are checked against extracted label data
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <Select value={selectedState} onValueChange={setSelectedState}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {states.map((state) => (
                      <SelectItem key={state.id} value={state.id}>
                        {state.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={openCreateDialog}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Rule
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{editingRule ? 'Edit Rule' : 'Create New Rule'}</DialogTitle>
                      <DialogDescription>
                        Define the compliance requirement and how it should be validated
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                      {/* Source Type Toggle */}
                      <div className="space-y-2">
                        <Label>Rule Source *</Label>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="source_type"
                              checked={formData.source_type === 'regulatory'}
                              onChange={() => setFormData(prev => ({ ...prev, source_type: 'regulatory' }))}
                              className="w-4 h-4"
                            />
                            <Globe className="w-4 h-4 text-chart-1" />
                            <span className="text-sm">Regulatory (from state law)</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="source_type"
                              checked={formData.source_type === 'internal'}
                              onChange={() => setFormData(prev => ({ ...prev, source_type: 'internal' }))}
                              className="w-4 h-4"
                            />
                            <User className="w-4 h-4 text-chart-3" />
                            <span className="text-sm">Internal (SOP rule)</span>
                          </label>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Rule Name *</Label>
                          <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="e.g., THC Warning Required"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="category">Category *</Label>
                          <Select
                            value={formData.category}
                            onValueChange={(v) => setFormData(prev => ({ ...prev, category: v }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              {RULE_CATEGORIES.map((cat) => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="description">Description *</Label>
                        <Textarea
                          id="description"
                          value={formData.description}
                          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Brief description of what this rule checks"
                          rows={2}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="validation_prompt">Validation Criteria *</Label>
                        <Textarea
                          id="validation_prompt"
                          value={formData.validation_prompt}
                          onChange={(e) => setFormData(prev => ({ ...prev, validation_prompt: e.target.value }))}
                          placeholder="Detailed criteria for the AI to evaluate..."
                          rows={4}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="severity">Severity *</Label>
                          <Select
                            value={formData.severity}
                            onValueChange={(v) => setFormData(prev => ({ ...prev, severity: v as ComplianceSeverity }))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="error">Error (Fail)</SelectItem>
                              <SelectItem value="warning">Warning</SelectItem>
                              <SelectItem value="info">Info</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {formData.source_type === 'regulatory' && (
                          <div className="space-y-2">
                            <Label htmlFor="citation">Regulation Citation *</Label>
                            <Input
                              id="citation"
                              value={formData.citation}
                              onChange={(e) => setFormData(prev => ({ ...prev, citation: e.target.value }))}
                              placeholder="e.g., ARM 37.107.402"
                            />
                          </div>
                        )}
                      </div>

                      {formData.source_type === 'regulatory' && (
                        <div className="space-y-2">
                          <Label htmlFor="source_url">Source URL *</Label>
                          <Input
                            id="source_url"
                            value={formData.source_url}
                            onChange={(e) => setFormData(prev => ({ ...prev, source_url: e.target.value }))}
                            placeholder="e.g., https://rules.mt.gov/gateway/ruleno.asp?RN=37.107.402"
                          />
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>Applicable Product Types</Label>
                        <div className="flex flex-wrap gap-3">
                          {Object.entries(PRODUCT_TYPE_LABELS).map(([value, label]) => (
                            <div key={value} className="flex items-center space-x-2">
                              <Checkbox
                                id={`product-${value}`}
                                checked={formData.product_types.includes(value as ProductType)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setFormData(prev => ({
                                      ...prev,
                                      product_types: [...prev.product_types, value as ProductType],
                                    }));
                                  } else {
                                    setFormData(prev => ({
                                      ...prev,
                                      product_types: prev.product_types.filter(p => p !== value),
                                    }));
                                  }
                                }}
                              />
                              <label htmlFor={`product-${value}`} className="text-sm">
                                {label}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Switch
                          id="is_active"
                          checked={formData.is_active}
                          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                        />
                        <Label htmlFor="is_active">Rule is active</Label>
                      </div>
                    </div>

                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {editingRule ? 'Update Rule' : 'Create Rule'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-8 text-center text-muted-foreground">Loading...</div>
            ) : rules.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-muted-foreground mb-4">
                  No rules defined for this state yet
                </p>
                <Button onClick={openCreateDialog}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Rule
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Active</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Citation</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule) => (
                    <TableRow key={rule.id} className={!rule.is_active ? 'opacity-50' : ''}>
                      <TableCell>
                        <Switch
                          checked={rule.is_active}
                          onCheckedChange={() => toggleRuleActive(rule)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{rule.name}</TableCell>
                      <TableCell>
                        {rule.source_type === 'internal' ? (
                          <Badge variant="outline" className="gap-1">
                            <User className="w-3 h-3" />
                            Internal
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 border-chart-1/50 text-chart-1">
                            <Globe className="w-3 h-3" />
                            Regulatory
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{rule.category}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getSeverityIcon(rule.severity)}
                          <span className="capitalize text-sm">{rule.severity}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {rule.source_type === 'internal' ? (
                          <span className="text-muted-foreground text-xs">N/A</span>
                        ) : (
                          <CitationLink 
                            citation={rule.citation} 
                            stateAbbreviation={states.find(s => s.id === selectedState)?.abbreviation || ''} 
                            sourceUrl={rule.source_url}
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">v{rule.version}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditDialog(rule)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(rule.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
