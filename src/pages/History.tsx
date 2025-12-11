import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ComplianceCheck, PRODUCT_TYPE_LABELS } from '@/types/compliance';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Search,
  ArrowRight,
  FileCheck,
} from 'lucide-react';

export default function History() {
  const [checks, setChecks] = useState<ComplianceCheck[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchChecks();
  }, []);

  const fetchChecks = async () => {
    try {
      const { data, error } = await supabase
        .from('compliance_checks')
        .select('*, states(name, abbreviation)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setChecks((data || []).map(check => ({
        ...check,
        states: check.states as ComplianceCheck['states']
      })) as ComplianceCheck[]);
    } catch (error) {
      console.error('Error fetching checks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'pass':
        return <CheckCircle2 className="w-4 h-4 text-chart-2" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-chart-4" />;
      case 'fail':
        return <XCircle className="w-4 h-4 text-destructive" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
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

  const filteredChecks = checks.filter(check => {
    const query = searchQuery.toLowerCase();
    return (
      (check.product_name?.toLowerCase().includes(query) || false) ||
      check.product_type.toLowerCase().includes(query) ||
      check.states?.name.toLowerCase().includes(query)
    );
  });

  return (
    <AppLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Compliance History</h1>
            <p className="text-muted-foreground mt-1">
              View all your past compliance checks
            </p>
          </div>
          <Button asChild>
            <Link to="/new-check">New Check</Link>
          </Button>
        </div>

        <Card className="border-2 border-border shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>All Compliance Checks</CardTitle>
                <CardDescription>{checks.length} total checks</CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search checks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-8 text-center text-muted-foreground">Loading...</div>
            ) : filteredChecks.length === 0 ? (
              <div className="py-12 text-center">
                <FileCheck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  {searchQuery ? 'No checks match your search' : 'No compliance checks yet'}
                </p>
                {!searchQuery && (
                  <Button asChild>
                    <Link to="/new-check">Start Your First Check</Link>
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Results</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredChecks.map((check) => (
                    <TableRow key={check.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(check.overall_status)}
                          {getStatusBadge(check.overall_status)}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {check.product_name || 'Unnamed Product'}
                      </TableCell>
                      <TableCell>{PRODUCT_TYPE_LABELS[check.product_type]}</TableCell>
                      <TableCell>{check.states?.abbreviation || '-'}</TableCell>
                      <TableCell>
                        {new Date(check.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-chart-2">{check.pass_count} pass</span>
                          <span className="text-chart-4">{check.warning_count} warn</span>
                          <span className="text-destructive">{check.fail_count} fail</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/results/${check.id}`}>
                            View
                            <ArrowRight className="w-4 h-4 ml-1" />
                          </Link>
                        </Button>
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
