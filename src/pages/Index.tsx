import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Shield, CheckCircle2, Upload, FileText, ArrowRight, Zap, Lock, BarChart3 } from 'lucide-react';

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b-2 border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl">CannLabel Compliance</span>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" asChild>
              <Link to="/auth">Sign In</Link>
            </Button>
            <Button asChild>
              <Link to="/auth">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="inline-block px-4 py-1 border-2 border-border bg-secondary text-sm font-medium mb-6">
          Montana Compliance Ready
        </div>
        <h1 className="text-5xl font-bold mb-6 max-w-3xl mx-auto leading-tight">
          AI-Powered Cannabis Label Compliance Validation
        </h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Validate your cannabis product labels against state regulations before submission. 
          Reduce rejections, save time, and ensure compliance with multimodal AI analysis.
        </p>
        <div className="flex gap-4 justify-center">
          <Button size="lg" asChild>
            <Link to="/auth">
              Start Free Compliance Check
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/auth">View Demo</Link>
          </Button>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-secondary border-y-2 border-border py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="font-bold mb-2">Select State & Product</h3>
              <p className="text-sm text-muted-foreground">
                Choose your state and product type to load the correct rule set
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="font-bold mb-2">Upload Label Images</h3>
              <p className="text-sm text-muted-foreground">
                Upload front, back, side panels and exit bag images
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="font-bold mb-2">AI Analysis</h3>
              <p className="text-sm text-muted-foreground">
                Our AI extracts text, symbols, and validates against rules
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                4
              </div>
              <h3 className="font-bold mb-2">Get Report</h3>
              <p className="text-sm text-muted-foreground">
                View results with pass/warn/fail status and export reports
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Why Choose CannLabel?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="border-2 border-border p-8 shadow-sm">
            <Zap className="w-10 h-10 mb-4" />
            <h3 className="text-xl font-bold mb-2">Fast Validation</h3>
            <p className="text-muted-foreground">
              Get compliance results in minutes, not days. Catch issues before state submission.
            </p>
          </div>
          <div className="border-2 border-border p-8 shadow-sm">
            <CheckCircle2 className="w-10 h-10 mb-4" />
            <h3 className="text-xl font-bold mb-2">Accurate AI Analysis</h3>
            <p className="text-muted-foreground">
              Multimodal AI reads every detail: text, symbols, warnings, THC content, net weight.
            </p>
          </div>
          <div className="border-2 border-border p-8 shadow-sm">
            <FileText className="w-10 h-10 mb-4" />
            <h3 className="text-xl font-bold mb-2">Detailed Reports</h3>
            <p className="text-muted-foreground">
              Export PDF or CSV reports with citations. Ready for QA review or regulatory submission.
            </p>
          </div>
          <div className="border-2 border-border p-8 shadow-sm">
            <Upload className="w-10 h-10 mb-4" />
            <h3 className="text-xl font-bold mb-2">Multi-Panel Support</h3>
            <p className="text-muted-foreground">
              Analyze front, back, side panels, and exit bags together for complete compliance.
            </p>
          </div>
          <div className="border-2 border-border p-8 shadow-sm">
            <Lock className="w-10 h-10 mb-4" />
            <h3 className="text-xl font-bold mb-2">Secure & Private</h3>
            <p className="text-muted-foreground">
              Your label images and compliance data are encrypted and never shared.
            </p>
          </div>
          <div className="border-2 border-border p-8 shadow-sm">
            <BarChart3 className="w-10 h-10 mb-4" />
            <h3 className="text-xl font-bold mb-2">Track History</h3>
            <p className="text-muted-foreground">
              View all past checks, compare versions, and track compliance improvements over time.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary text-primary-foreground py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Validate Your Labels?</h2>
          <p className="text-lg opacity-90 mb-8 max-w-xl mx-auto">
            Stop worrying about state rejections. Get AI-powered compliance checks in minutes.
          </p>
          <Button size="lg" variant="secondary" asChild>
            <Link to="/auth">
              Create Free Account
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t-2 border-border py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>© 2024 CannLabel Compliance. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
