import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Shield, CheckCircle2, Upload, FileText, ArrowRight, Zap, Lock, BarChart3 } from 'lucide-react';

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary rounded-md flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg">CannLabel Compliance</span>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" asChild>
              <Link to="/auth">Sign In</Link>
            </Button>
            <Button asChild>
              <Link to="/auth">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-6 py-20 text-center">
        <div className="inline-block px-4 py-1.5 rounded-full border border-border bg-secondary text-sm font-medium mb-6">
          Montana Compliance Ready
        </div>
        <h1 className="text-4xl md:text-5xl font-semibold mb-6 max-w-3xl mx-auto leading-tight text-foreground">
          AI-Powered Cannabis Label Compliance Validation
        </h1>
        <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
          Validate your cannabis product labels against state regulations before submission. 
          Reduce rejections, save time, and ensure compliance with multimodal AI analysis.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Button size="lg" asChild>
            <Link to="/auth">
              Start Free Compliance Check
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/auth">View Demo</Link>
          </Button>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-secondary/50 border-y border-border py-16">
        <div className="container mx-auto px-6">
          <h2 className="text-2xl font-semibold text-center mb-12">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { num: 1, title: 'Select State & Product', desc: 'Choose your state and product type to load the correct rule set' },
              { num: 2, title: 'Upload Label Images', desc: 'Upload front, back, side panels and exit bag images' },
              { num: 3, title: 'AI Analysis', desc: 'Our AI extracts text, symbols, and validates against rules' },
              { num: 4, title: 'Get Report', desc: 'View results with pass/warn/fail status and export reports' },
            ].map((step) => (
              <div key={step.num} className="text-center">
                <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-lg font-semibold mx-auto mb-4">
                  {step.num}
                </div>
                <h3 className="font-medium mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-6 py-16">
        <h2 className="text-2xl font-semibold text-center mb-12">Why Choose CannLabel?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: Zap, title: 'Fast Validation', desc: 'Get compliance results in minutes, not days. Catch issues before state submission.' },
            { icon: CheckCircle2, title: 'Accurate AI Analysis', desc: 'Multimodal AI reads every detail: text, symbols, warnings, THC content, net weight.' },
            { icon: FileText, title: 'Detailed Reports', desc: 'Export PDF or CSV reports with citations. Ready for QA review or regulatory submission.' },
            { icon: Upload, title: 'Multi-Panel Support', desc: 'Analyze front, back, side panels, and exit bags together for complete compliance.' },
            { icon: Lock, title: 'Secure & Private', desc: 'Your label images and compliance data are encrypted and never shared.' },
            { icon: BarChart3, title: 'Track History', desc: 'View all past checks, compare versions, and track compliance improvements over time.' },
          ].map((feature) => (
            <div key={feature.title} className="border border-border rounded-lg p-6 bg-card">
              <feature.icon className="w-8 h-8 mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary text-primary-foreground py-16">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-2xl font-semibold mb-4">Ready to Validate Your Labels?</h2>
          <p className="text-base opacity-90 mb-8 max-w-xl mx-auto">
            Stop worrying about state rejections. Get AI-powered compliance checks in minutes.
          </p>
          <Button size="lg" variant="secondary" asChild>
            <Link to="/auth">
              Create Free Account
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-6 text-center text-muted-foreground text-sm">
          <p>© 2024 CannLabel Compliance. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
