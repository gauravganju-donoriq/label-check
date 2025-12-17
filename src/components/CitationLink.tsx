import { ExternalLink, CheckCircle2, Search, AlertTriangle } from 'lucide-react';
import { resolveCitation, VerificationStatus } from '@/lib/citationResolver';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface CitationLinkProps {
  citation: string | null | undefined;
  stateAbbreviation: string;
  sourceUrl?: string | null;
  className?: string;
  showIcon?: boolean;
  showVerificationBadge?: boolean;
}

function getVerificationIcon(status: VerificationStatus) {
  switch (status) {
    case 'verified':
      return <CheckCircle2 className="w-3 h-3 text-chart-2" />;
    case 'search':
      return <Search className="w-3 h-3 text-chart-4" />;
    case 'unverified':
      return <AlertTriangle className="w-3 h-3 text-muted-foreground" />;
  }
}

function getVerificationTooltip(status: VerificationStatus, isDirectLink: boolean) {
  switch (status) {
    case 'verified':
      return isDirectLink ? 'Verified: Direct link to regulation' : 'Verified source URL';
    case 'search':
      return 'Search link: Opens regulatory search page';
    case 'unverified':
      return 'Unverified: No source URL available';
  }
}

export function CitationLink({
  citation,
  stateAbbreviation,
  sourceUrl,
  className,
  showIcon = true,
  showVerificationBadge = false,
}: CitationLinkProps) {
  const result = resolveCitation(citation, stateAbbreviation, sourceUrl);

  // No citation to display
  if (!citation || citation === 'N/A') {
    return <span className={cn('text-muted-foreground', className)}>N/A</span>;
  }

  // No URL available - display as plain text with warning
  if (!result.url) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn('inline-flex items-center gap-1 text-muted-foreground', className)}>
              {result.displayText}
              {showVerificationBadge && (
                <AlertTriangle className="w-3 h-3 text-muted-foreground" />
              )}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="text-xs">No verified source URL available for this citation</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'inline-flex items-center gap-1 hover:underline transition-colors',
              result.verificationStatus === 'verified' 
                ? 'text-primary hover:text-primary/80' 
                : 'text-chart-4 hover:text-chart-4/80',
              className
            )}
          >
            {result.displayText}
            {showVerificationBadge && getVerificationIcon(result.verificationStatus)}
            {showIcon && <ExternalLink className="w-3 h-3 flex-shrink-0" />}
          </a>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="text-xs font-medium flex items-center gap-1">
              {getVerificationIcon(result.verificationStatus)}
              {getVerificationTooltip(result.verificationStatus, result.isDirectLink)}
            </p>
            <p className="text-xs text-muted-foreground truncate max-w-[250px]">{result.url}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
