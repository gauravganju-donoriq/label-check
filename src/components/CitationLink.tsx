import { ExternalLink } from 'lucide-react';
import { resolveCitation, CitationResult } from '@/lib/citationResolver';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface CitationLinkProps {
  citation: string | null | undefined;
  stateAbbreviation: string;
  sourceUrl?: string | null;
  className?: string;
  showIcon?: boolean;
}

export function CitationLink({
  citation,
  stateAbbreviation,
  sourceUrl,
  className,
  showIcon = true,
}: CitationLinkProps) {
  const result = resolveCitation(citation, stateAbbreviation, sourceUrl);

  // No citation to display
  if (!citation || citation === 'N/A') {
    return <span className={cn('text-muted-foreground', className)}>N/A</span>;
  }

  // No URL available - display as plain text
  if (!result.url) {
    return <span className={className}>{result.displayText}</span>;
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
              'inline-flex items-center gap-1 text-primary hover:text-primary/80 hover:underline transition-colors',
              className
            )}
          >
            {result.displayText}
            {showIcon && <ExternalLink className="w-3 h-3 flex-shrink-0" />}
          </a>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-xs">
            {result.isDirectLink ? 'View regulation' : 'Search for regulation'}
          </p>
          <p className="text-xs text-muted-foreground truncate">{result.url}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
