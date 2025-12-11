import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  State,
  ProductType,
  PanelType,
  PRODUCT_TYPE_LABELS,
  PANEL_TYPE_LABELS,
  CustomRule,
} from '@/types/compliance';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Upload,
  X,
  FileImage,
  Loader2,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';

interface UploadedPanel {
  id: string;
  panelType: PanelType;
  file: File;
  preview: string;
}

type Step = 'select' | 'upload' | 'analyze' | 'complete';

export default function NewCheck() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>('select');
  const [states, setStates] = useState<State[]>([]);
  const [customRules, setCustomRules] = useState<CustomRule[]>([]);
  const [selectedState, setSelectedState] = useState<string>('');
  const [productType, setProductType] = useState<ProductType | ''>('');
  const [productName, setProductName] = useState('');
  const [panels, setPanels] = useState<UploadedPanel[]>([]);
  const [selectedCustomRules, setSelectedCustomRules] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState('');
  const [complianceCheckId, setComplianceCheckId] = useState<string | null>(null);

  useEffect(() => {
    fetchStates();
    fetchCustomRules();
  }, []);

  const fetchStates = async () => {
    const { data, error } = await supabase
      .from('states')
      .select('*')
      .eq('is_enabled', true);
    
    if (error) {
      console.error('Error fetching states:', error);
      return;
    }
    setStates((data || []) as State[]);
  };

  const fetchCustomRules = async () => {
    const { data, error } = await supabase
      .from('custom_rules')
      .select('*')
      .eq('is_active', true);
    
    if (!error && data) {
      setCustomRules(data as CustomRule[]);
    }
  };

  const handleFileUpload = useCallback((files: FileList | null, panelType: PanelType) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      toast({
        variant: 'destructive',
        title: 'Invalid file type',
        description: 'Please upload an image (JPG, PNG) or PDF file.',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const newPanel: UploadedPanel = {
        id: crypto.randomUUID(),
        panelType,
        file,
        preview: reader.result as string,
      };
      
      setPanels(prev => {
        const filtered = prev.filter(p => p.panelType !== panelType);
        return [...filtered, newPanel];
      });
    };
    reader.readAsDataURL(file);
  }, [toast]);

  const removePanel = (id: string) => {
    setPanels(prev => prev.filter(p => p.id !== id));
  };

  const canProceedToUpload = selectedState && productType;
  const canProceedToAnalyze = panels.length > 0;

  const runAnalysis = async () => {
    if (!user || !selectedState || !productType) return;

    setIsAnalyzing(true);
    setStep('analyze');
    setAnalysisProgress(0);

    try {
      // Create compliance check record
      setAnalysisStatus('Creating compliance check...');
      const { data: checkData, error: checkError } = await supabase
        .from('compliance_checks')
        .insert({
          user_id: user.id,
          state_id: selectedState,
          product_type: productType,
          product_name: productName || null,
        })
        .select()
        .single();

      if (checkError) throw checkError;
      
      const checkId = checkData.id;
      setComplianceCheckId(checkId);
      setAnalysisProgress(10);

      // Upload panels and run AI analysis
      const extractedPanels: Array<{
        panelId: string;
        panelType: string;
        extractedData: Record<string, unknown>;
      }> = [];

      const state = states.find(s => s.id === selectedState);

      for (let i = 0; i < panels.length; i++) {
        const panel = panels[i];
        setAnalysisStatus(`Uploading ${PANEL_TYPE_LABELS[panel.panelType]}...`);

        // Upload to storage
        const filePath = `${user.id}/${checkId}/${panel.panelType}_${Date.now()}`;
        const { error: uploadError } = await supabase.storage
          .from('label-uploads')
          .upload(filePath, panel.file);

        if (uploadError) throw uploadError;

        // Create panel record
        const { data: panelData, error: panelError } = await supabase
          .from('panel_uploads')
          .insert({
            compliance_check_id: checkId,
            panel_type: panel.panelType,
            file_path: filePath,
            file_name: panel.file.name,
          })
          .select()
          .single();

        if (panelError) throw panelError;

        setAnalysisProgress(10 + ((i + 1) / panels.length) * 30);
        setAnalysisStatus(`Analyzing ${PANEL_TYPE_LABELS[panel.panelType]}...`);

        // Run AI analysis on this panel
        const { data: analysisData, error: analysisError } = await supabase.functions.invoke(
          'analyze-label',
          {
            body: {
              imageBase64: panel.preview,
              panelType: panel.panelType,
              productType,
              stateName: state?.name || 'Montana',
            },
          }
        );

        if (analysisError) {
          console.error('Analysis error:', analysisError);
          throw new Error('Failed to analyze panel');
        }

        // Update panel with extracted data
        await supabase
          .from('panel_uploads')
          .update({ extracted_data: analysisData.extractedData })
          .eq('id', panelData.id);

        extractedPanels.push({
          panelId: panelData.id,
          panelType: panel.panelType,
          extractedData: analysisData.extractedData,
        });

        setAnalysisProgress(40 + ((i + 1) / panels.length) * 20);
      }

      // Fetch compliance rules for the selected state
      setAnalysisStatus('Fetching compliance rules...');
      const { data: rules, error: rulesError } = await supabase
        .from('compliance_rules')
        .select('*')
        .eq('state_id', selectedState)
        .eq('is_active', true)
        .contains('product_types', [productType]);

      if (rulesError) throw rulesError;
      setAnalysisProgress(65);

      // Get selected custom rules
      const activeCustomRules = customRules.filter(r => selectedCustomRules.includes(r.id));

      // Run compliance check
      setAnalysisStatus('Running compliance validation...');
      const { data: complianceData, error: complianceError } = await supabase.functions.invoke(
        'run-compliance-check',
        {
          body: {
            complianceCheckId: checkId,
            extractedPanels,
            rules: rules || [],
            customRules: activeCustomRules,
          },
        }
      );

      if (complianceError) throw complianceError;
      setAnalysisProgress(85);

      // Save results
      setAnalysisStatus('Saving results...');
      const results = complianceData.results || [];
      
      for (const result of results) {
        await supabase.from('check_results').insert({
          compliance_check_id: checkId,
          rule_id: result.ruleId?.startsWith('custom_') ? null : result.ruleId,
          custom_rule_id: result.ruleId?.startsWith('custom_') ? result.ruleId.replace('custom_', '') : null,
          status: result.status,
          found_value: result.foundValue,
          expected_value: result.expectedValue,
          explanation: result.explanation,
          citation: result.citation,
        });
      }

      // Update compliance check with summary
      await supabase
        .from('compliance_checks')
        .update({
          overall_status: complianceData.summary.overallStatus,
          pass_count: complianceData.summary.passCount,
          warning_count: complianceData.summary.warningCount,
          fail_count: complianceData.summary.failCount,
          completed_at: new Date().toISOString(),
        })
        .eq('id', checkId);

      setAnalysisProgress(100);
      setAnalysisStatus('Analysis complete!');
      setStep('complete');

      toast({
        title: 'Analysis Complete',
        description: 'Your label compliance check has been completed.',
      });

    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        variant: 'destructive',
        title: 'Analysis Failed',
        description: error instanceof Error ? error.message : 'An error occurred during analysis.',
      });
      setIsAnalyzing(false);
      setStep('upload');
    }
  };

  return (
    <AppLayout>
      <div className="p-8 max-w-4xl mx-auto">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {['Select', 'Upload', 'Analyze', 'Complete'].map((label, index) => {
              const stepKeys: Step[] = ['select', 'upload', 'analyze', 'complete'];
              const isActive = stepKeys.indexOf(step) >= index;
              const isCurrent = stepKeys[index] === step;
              
              return (
                <div key={label} className="flex items-center">
                  <div
                    className={`w-10 h-10 flex items-center justify-center font-bold border-2 ${
                      isActive
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-muted-foreground border-border'
                    } ${isCurrent ? 'shadow-sm' : ''}`}
                  >
                    {index + 1}
                  </div>
                  <span className={`ml-2 text-sm font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {label}
                  </span>
                  {index < 3 && (
                    <div className={`w-12 h-0.5 mx-4 ${isActive ? 'bg-primary' : 'bg-border'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step 1: Select State & Product */}
        {step === 'select' && (
          <Card className="border-2 border-border shadow-sm">
            <CardHeader>
              <CardTitle>Select State & Product</CardTitle>
              <CardDescription>
                Choose the state and product type for compliance validation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="state">State *</Label>
                  <Select value={selectedState} onValueChange={setSelectedState}>
                    <SelectTrigger id="state">
                      <SelectValue placeholder="Select a state" />
                    </SelectTrigger>
                    <SelectContent>
                      {states.map((state) => (
                        <SelectItem key={state.id} value={state.id}>
                          {state.name} ({state.abbreviation})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="productType">Product Type *</Label>
                  <Select value={productType} onValueChange={(v) => setProductType(v as ProductType)}>
                    <SelectTrigger id="productType">
                      <SelectValue placeholder="Select product type" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PRODUCT_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="productName">Product Name (Optional)</Label>
                <Input
                  id="productName"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Enter product name for identification"
                />
              </div>

              {customRules.length > 0 && (
                <div className="space-y-3">
                  <Label>Internal Rules (Optional)</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable additional internal SOP rules to check
                  </p>
                  <div className="space-y-2">
                    {customRules.map((rule) => (
                      <div key={rule.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={rule.id}
                          checked={selectedCustomRules.includes(rule.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedCustomRules(prev => [...prev, rule.id]);
                            } else {
                              setSelectedCustomRules(prev => prev.filter(id => id !== rule.id));
                            }
                          }}
                        />
                        <label htmlFor={rule.id} className="text-sm cursor-pointer">
                          {rule.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-4">
                <Button onClick={() => setStep('upload')} disabled={!canProceedToUpload}>
                  Continue to Upload
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Upload Panels */}
        {step === 'upload' && (
          <Card className="border-2 border-border shadow-sm">
            <CardHeader>
              <CardTitle>Upload Label Panels</CardTitle>
              <CardDescription>
                Upload images of each panel of your product label/packaging
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(Object.entries(PANEL_TYPE_LABELS) as [PanelType, string][]).map(([type, label]) => {
                  const existingPanel = panels.find(p => p.panelType === type);
                  
                  return (
                    <div
                      key={type}
                      className="relative border-2 border-dashed border-border p-4 text-center min-h-[200px] flex flex-col items-center justify-center"
                    >
                      {existingPanel ? (
                        <>
                          <button
                            onClick={() => removePanel(existingPanel.id)}
                            className="absolute top-2 right-2 p-1 bg-destructive text-destructive-foreground hover:opacity-80"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <img
                            src={existingPanel.preview}
                            alt={label}
                            className="max-h-32 object-contain mb-2"
                          />
                          <p className="text-sm font-medium">{label}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-full">
                            {existingPanel.file.name}
                          </p>
                        </>
                      ) : (
                        <label className="cursor-pointer flex flex-col items-center gap-2">
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            className="hidden"
                            onChange={(e) => handleFileUpload(e.target.files, type)}
                          />
                          <FileImage className="w-8 h-8 text-muted-foreground" />
                          <span className="text-sm font-medium">{label}</span>
                          <span className="text-xs text-muted-foreground">Click to upload</span>
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep('select')}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button onClick={runAnalysis} disabled={!canProceedToAnalyze}>
                  <Upload className="w-4 h-4 mr-2" />
                  Run Analysis
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Analysis in Progress */}
        {step === 'analyze' && (
          <Card className="border-2 border-border shadow-sm">
            <CardHeader className="text-center">
              <CardTitle>Analyzing Your Labels</CardTitle>
              <CardDescription>
                Our AI is extracting and validating compliance data
              </CardDescription>
            </CardHeader>
            <CardContent className="py-8">
              <div className="max-w-md mx-auto space-y-6">
                <div className="flex justify-center">
                  <Loader2 className="w-16 h-16 animate-spin text-primary" />
                </div>
                <Progress value={analysisProgress} className="h-3" />
                <p className="text-center text-sm font-medium">{analysisStatus}</p>
                <p className="text-center text-xs text-muted-foreground">
                  {analysisProgress}% complete
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Complete */}
        {step === 'complete' && (
          <Card className="border-2 border-border shadow-sm">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-chart-2 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-primary-foreground" />
              </div>
              <CardTitle>Analysis Complete!</CardTitle>
              <CardDescription>
                Your compliance check has been completed successfully
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center gap-4 pt-4">
              <Button variant="outline" onClick={() => navigate('/dashboard')}>
                Back to Dashboard
              </Button>
              <Button onClick={() => navigate(`/results/${complianceCheckId}`)}>
                View Results
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
