import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { ComplianceCheck } from '@/types/compliance';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  FileCheck,
  Clock,
} from 'lucide-react';

export default function Dashboard() {
  const { profile } = useAuth();
  const [recentChecks, setRecentChecks] = useState<ComplianceCheck[]>([]);
  const [stats, setStats] = useState({ total: 0, passed: 0, warnings: 0, failed: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const { data: checks, error } = await supabase
        .from('compliance_checks')
        .select('*, states(name, abbreviation)')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;

      const typedChecks = (checks || []).map(check => ({
        ...check,
        states: check.states as ComplianceCheck['states']
      })) as ComplianceCheck[];

      setRecentChecks(typedChecks);

      // Calculate stats
      const { data: allChecks } = await supabase
        .from('compliance_checks')
        .select('overall_status')
        .not('overall_status', 'is', null);

      if (allChecks) {
        setStats({
          total: allChecks.length,
          passed: allChecks.filter(c => c.overall_status === 'pass').length,
          warnings: allChecks.filter(c => c.overall_status === 'warning').length,
          failed: allChecks.filter(c => c.overall_status === 'fail').length,
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'pass':
        return <CheckCircle2 className="w-5 h-5 text-chart-2" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-chart-4" />;
      case 'fail':
        return <XCircle className="w-5 h-5 text-destructive" />;
      default:
        return <Clock className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'pass':
        return <Badge className="bg-chart-2 text-primary-foreground">Passed</Badge>;
      case 'warning':
        return <Badge className="bg-chart-4 text-primary-foreground">Warnings</Badge>;
      case 'fail':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">In Progress</Badge>;
    }
  };

  return (
    <AppLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">
            Welcome back{profile?.full_name ? `, ${profile.full_name}` : ''}
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor your label compliance checks and start new validations.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-2 border-border shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Checks</p>
                  <p className="text-3xl font-bold mt-1">{stats.total}</p>
                </div>
                <FileCheck className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-border shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Passed</p>
                  <p className="text-3xl font-bold mt-1 text-chart-2">{stats.passed}</p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-chart-2" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-border shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Warnings</p>
                  <p className="text-3xl font-bold mt-1 text-chart-4">{stats.warnings}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-chart-4" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-border shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Failed</p>
                  <p className="text-3xl font-bold mt-1 text-destructive">{stats.failed}</p>
                </div>
                <XCircle className="w-8 h-8 text-destructive" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="mb-8 border-2 border-border shadow-sm">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <Button asChild size="lg">
                <Link to="/new-check">
                  <Upload className="w-5 h-5 mr-2" />
                  New Compliance Check
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/history">
                  View All History
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Checks */}
        <Card className="border-2 border-border shadow-sm">
          <CardHeader>
            <CardTitle>Recent Compliance Checks</CardTitle>
            <CardDescription>Your most recent label validations</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-8 text-center text-muted-foreground">Loading...</div>
            ) : recentChecks.length === 0 ? (
              <div className="py-8 text-center">
                <FileCheck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No compliance checks yet</p>
                <Button asChild>
                  <Link to="/new-check">Start Your First Check</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {recentChecks.map((check) => (
                  <Link
                    key={check.id}
                    to={`/results/${check.id}`}
                    className="flex items-center justify-between p-4 border-2 border-border hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      {getStatusIcon(check.overall_status)}
                      <div>
                        <p className="font-medium">
                          {check.product_name || `${check.product_type} Product`}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {check.states?.name} • {new Date(check.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {getStatusBadge(check.overall_status)}
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
