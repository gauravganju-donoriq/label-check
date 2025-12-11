import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  ComplianceCheck,
  CheckResult,
  PanelUpload,
  ComplianceRule,
  PRODUCT_TYPE_LABELS,
  PANEL_TYPE_LABELS,
  PanelType,
} from '@/types/compliance';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  ArrowLeft,
  FileText,
  Image,
  ExternalLink,
} from 'lucide-react';

export default function Results() {
  const { id } = useParams<{ id: string }>();
  const [check, setCheck] = useState<ComplianceCheck | null>(null);
  const [results, setResults] = useState<CheckResult[]>([]);
  const [panels, setPanels] = useState<PanelUpload[]>([]);
  const [rules, setRules] = useState<ComplianceRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchResults();
    }
  }, [id]);

  const fetchResults = async () => {
    try {
      const { data: checkData, error: checkError } = await supabase
        .from('compliance_checks')
        .select('*, states(name, abbreviation)')
        .eq('id', id)
        .single();

      if (checkError) throw checkError;
      
      setCheck({
        ...checkData,
        states: checkData.states as ComplianceCheck['states']
      } as ComplianceCheck);

      const { data: panelsData } = await supabase
        .from('panel_uploads')
        .select('*')
        .eq('compliance_check_id', id);
      
      setPanels((panelsData || []) as PanelUpload[]);

      const { data: resultsData } = await supabase
        .from('check_results')
        .select('*, compliance_rules(*)')
        .eq('compliance_check_id', id);
      
      setResults((resultsData || []).map(r => ({
        ...r,
        compliance_rules: r.compliance_rules as CheckResult['compliance_rules']
      })) as CheckResult[]);

      const { data: rulesData } = await supabase
        .from('compliance_rules')
        .select('*')
        .eq('state_id', checkData.state_id);
      
      setRules((rulesData || []) as ComplianceRule[]);

    } catch (error) {
      console.error('Error fetching results:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle2 className="w-5 h-5 text-chart-2" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-chart-4" />;
      case 'fail':
        return <XCircle className="w-5 h-5 text-destructive" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pass':
        return <Badge className="bg-chart-2 text-primary-foreground">Pass</Badge>;
      case 'warning':
        return <Badge className="bg-chart-4 text-primary-foreground">Warning</Badge>;
      case 'fail':
        return <Badge variant="destructive">Fail</Badge>;
      default:
        return null;
    }
  };

  const downloadCSV = () => {
    if (!check || !results.length) return;

    const headers = ['Rule Name', 'Category', 'Status', 'Found Value', 'Expected Value', 'Explanation', 'Citation'];
    const rows = results.map(r => [
      r.compliance_rules?.name || 'Custom Rule',
      r.compliance_rules?.category || 'Custom',
      r.status,
      r.found_value || '',
      r.expected_value || '',
      r.explanation || '',
      r.citation || '',
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compliance-report-${check.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const groupedResults = results.reduce((acc, result) => {
    const category = result.compliance_rules?.category || 'Custom Rules';
    if (!acc[category]) acc[category] = [];
    acc[category].push(result);
    return acc;
  }, {} as Record<string, CheckResult[]>);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-6 lg:p-8 flex items-center justify-center">
          <p className="text-muted-foreground">Loading results...</p>
        </div>
      </AppLayout>
    );
  }

  if (!check) {
    return (
      <AppLayout>
        <div className="p-6 lg:p-8 text-center">
          <p className="text-muted-foreground mb-4">Compliance check not found</p>
          <Button asChild>
            <Link to="/dashboard">Back to Dashboard</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/dashboard">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Link>
              </Button>
            </div>
            <h1 className="text-2xl font-semibold">
              {check.product_name || `${PRODUCT_TYPE_LABELS[check.product_type]} Product`}
            </h1>
            <p className="text-muted-foreground">
              {check.states?.name} • {new Date(check.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadCSV}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className={`border-l-4 ${
            check.overall_status === 'pass' ? 'border-l-chart-2' :
            check.overall_status === 'warning' ? 'border-l-chart-4' :
            'border-l-destructive'
          }`}>
            <CardContent className="pt-6 text-center">
              <div className="flex justify-center mb-2">
                {getStatusIcon(check.overall_status || '')}
              </div>
              <p className="text-sm text-muted-foreground">Overall Status</p>
              <p className="text-lg font-semibold capitalize">{check.overall_status || 'Pending'}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 text-center">
              <CheckCircle2 className="w-6 h-6 mx-auto text-chart-2 mb-2" />
              <p className="text-sm text-muted-foreground">Passed</p>
              <p className="text-2xl font-semibold text-chart-2">{check.pass_count}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 text-center">
              <AlertTriangle className="w-6 h-6 mx-auto text-chart-4 mb-2" />
              <p className="text-sm text-muted-foreground">Warnings</p>
              <p className="text-2xl font-semibold text-chart-4">{check.warning_count}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 text-center">
              <XCircle className="w-6 h-6 mx-auto text-destructive mb-2" />
              <p className="text-sm text-muted-foreground">Failed</p>
              <p className="text-2xl font-semibold text-destructive">{check.fail_count}</p>
            </CardContent>
          </Card>
        </div>

        {/* Results Tabs */}
        <Tabs defaultValue="checklist" className="space-y-4">
          <TabsList>
            <TabsTrigger value="checklist" className="gap-2">
              <FileText className="w-4 h-4" />
              Compliance Checklist
            </TabsTrigger>
            <TabsTrigger value="panels" className="gap-2">
              <Image className="w-4 h-4" />
              Uploaded Panels ({panels.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="checklist">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Compliance Results by Category</CardTitle>
                <CardDescription>
                  Detailed findings for each compliance rule
                </CardDescription>
              </CardHeader>
              <CardContent>
                {Object.keys(groupedResults).length === 0 ? (
                  <p className="text-muted-foreground py-8 text-center">
                    No compliance results available
                  </p>
                ) : (
                  <Accordion type="multiple" className="space-y-2">
                    {Object.entries(groupedResults).map(([category, categoryResults]) => {
                      const passCount = categoryResults.filter(r => r.status === 'pass').length;
                      const warnCount = categoryResults.filter(r => r.status === 'warning').length;
                      const failCount = categoryResults.filter(r => r.status === 'fail').length;
                      
                      return (
                        <AccordionItem key={category} value={category} className="border border-border rounded-lg px-4">
                          <AccordionTrigger className="hover:no-underline py-4">
                            <div className="flex items-center justify-between w-full pr-4">
                              <span className="font-medium">{category}</span>
                              <div className="flex gap-3 text-xs">
                                {passCount > 0 && (
                                  <span className="text-chart-2">{passCount} pass</span>
                                )}
                                {warnCount > 0 && (
                                  <span className="text-chart-4">{warnCount} warn</span>
                                )}
                                {failCount > 0 && (
                                  <span className="text-destructive">{failCount} fail</span>
                                )}
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pb-4">
                            <div className="space-y-3">
                              {categoryResults.map((result) => (
                                <div
                                  key={result.id}
                                  className="p-4 rounded-lg border border-border bg-card"
                                >
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                      {getStatusIcon(result.status)}
                                      <div>
                                        <p className="font-medium text-sm">
                                          {result.compliance_rules?.name || 'Custom Rule'}
                                        </p>
                                        {result.citation && (
                                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                                            <ExternalLink className="w-3 h-3" />
                                            {result.citation}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    {getStatusBadge(result.status)}
                                  </div>
                                  
                                  {result.explanation && (
                                    <p className="text-sm text-muted-foreground mb-3">
                                      {result.explanation}
                                    </p>
                                  )}
                                  
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    {result.found_value && (
                                      <div>
                                        <p className="text-xs text-muted-foreground uppercase mb-1">Found</p>
                                        <p className="font-mono text-xs bg-muted px-2 py-1 rounded">{result.found_value}</p>
                                      </div>
                                    )}
                                    {result.expected_value && (
                                      <div>
                                        <p className="text-xs text-muted-foreground uppercase mb-1">Expected</p>
                                        <p className="font-mono text-xs bg-muted px-2 py-1 rounded">{result.expected_value}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="panels">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Uploaded Panel Images</CardTitle>
                <CardDescription>
                  The label panels that were analyzed
                </CardDescription>
              </CardHeader>
              <CardContent>
                {panels.length === 0 ? (
                  <p className="text-muted-foreground py-8 text-center">
                    No panels uploaded
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {panels.map((panel) => (
                      <div key={panel.id} className="border border-border rounded-lg p-4">
                        <p className="font-medium text-sm mb-2">
                          {PANEL_TYPE_LABELS[panel.panel_type as PanelType]}
                        </p>
                        <p className="text-xs text-muted-foreground mb-3 truncate">
                          {panel.file_name}
                        </p>
                        {panel.extracted_data && (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                              View extracted data
                            </summary>
                            <pre className="mt-2 p-2 bg-muted rounded overflow-auto max-h-48 text-xs">
                              {JSON.stringify(panel.extracted_data, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
