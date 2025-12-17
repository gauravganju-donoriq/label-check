/**
 * Citation Resolver Utility
 * Resolves regulatory citations to clickable URLs based on state and citation format
 */

interface CitationResult {
  url: string | null;
  displayText: string;
  isDirectLink: boolean; // true if URL goes directly to the citation, false if it's a search/general page
}

// State-specific citation patterns and URL resolvers
const stateResolvers: Record<string, (citation: string) => CitationResult | null> = {
  MT: resolveMontanaCitation,
  CO: resolveColoradoCitation,
  CA: resolveCaliforniaCitation,
};

// Montana citation resolver
function resolveMontanaCitation(citation: string): CitationResult | null {
  // Pattern: ARM 37.107.402 or Mont. Admin. r. 42.39.314
  const armMatch = citation.match(/ARM\s*(\d+)\.(\d+)\.(\d+)/i);
  if (armMatch) {
    const [, title, chapter, rule] = armMatch;
    return {
      url: `https://rules.mt.gov/gateway/RuleNo.asp?RN=${title}%2E${chapter}%2E${rule}`,
      displayText: citation,
      isDirectLink: true,
    };
  }

  const montAdminMatch = citation.match(/Mont\.?\s*Admin\.?\s*r\.?\s*(\d+)\.(\d+)\.(\d+)/i);
  if (montAdminMatch) {
    const [, title, chapter, rule] = montAdminMatch;
    return {
      url: `https://rules.mt.gov/gateway/RuleNo.asp?RN=${title}%2E${chapter}%2E${rule}`,
      displayText: citation,
      isDirectLink: true,
    };
  }

  // Montana Code Annotated (MCA)
  const mcaMatch = citation.match(/MCA\s*(\d+)-(\d+)-(\d+)/i);
  if (mcaMatch) {
    const [, title, chapter, section] = mcaMatch;
    return {
      url: `https://leg.mt.gov/bills/mca/title_${title.padStart(4, '0')}/chapter_${chapter.padStart(3, '0')}/part_0/section_${section.padStart(3, '0')}/0${title.padStart(2, '0')}${chapter.padStart(2, '0')}0${section.padStart(2, '0')}.html`,
      displayText: citation,
      isDirectLink: true,
    };
  }

  // Fallback to Montana rules search
  return {
    url: `https://rules.mt.gov/gateway/Search.asp?txtSearchString=${encodeURIComponent(citation)}`,
    displayText: citation,
    isDirectLink: false,
  };
}

// Colorado citation resolver
function resolveColoradoCitation(citation: string): CitationResult | null {
  // Pattern: 1 CCR 212-3 or CCR 212-3
  const ccrMatch = citation.match(/(\d+)?\s*CCR\s*(\d+)-(\d+)/i);
  if (ccrMatch) {
    const [, book, series, rule] = ccrMatch;
    // Colorado Secretary of State CCR search
    return {
      url: `https://www.sos.state.co.us/CCR/DisplayRule.do?action=ruleinfo&ruleId=${series}&deptID=16`,
      displayText: citation,
      isDirectLink: false,
    };
  }

  // Colorado Revised Statutes (CRS)
  const crsMatch = citation.match(/(?:C\.?R\.?S\.?|CRS)\s*§?\s*(\d+)-(\d+)-(\d+)/i);
  if (crsMatch) {
    const [, title, article, section] = crsMatch;
    return {
      url: `https://leg.colorado.gov/colorado-revised-statutes`,
      displayText: citation,
      isDirectLink: false,
    };
  }

  // Fallback to Colorado MED rules page
  return {
    url: `https://med.colorado.gov/rules`,
    displayText: citation,
    isDirectLink: false,
  };
}

// California citation resolver
function resolveCaliforniaCitation(citation: string): CitationResult | null {
  // Pattern: Cal. Code Regs., tit. 4, § 15000 or CCR Title 4 Section 15000
  const calRegMatch = citation.match(/(?:Cal\.?\s*Code\s*Regs\.?,?\s*)?(?:tit\.?|title)\s*(\d+),?\s*§?\s*(\d+)/i);
  if (calRegMatch) {
    const [, title, section] = calRegMatch;
    return {
      url: `https://govt.westlaw.com/calregs/Document/I${section}?viewType=FullText&originationContext=documenttoc&transitionType=CategoryPageItem&contextData=(sc.Default)`,
      displayText: citation,
      isDirectLink: false,
    };
  }

  // Business & Professions Code
  const bpcMatch = citation.match(/(?:B\.?&?P\.?|Bus\.?\s*&?\s*Prof\.?)\s*Code\s*§?\s*(\d+)/i);
  if (bpcMatch) {
    const [, section] = bpcMatch;
    return {
      url: `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=BPC&sectionNum=${section}`,
      displayText: citation,
      isDirectLink: true,
    };
  }

  // Fallback to California DCC regulations
  return {
    url: `https://cannabis.ca.gov/cannabis-laws/dcc-regulations/`,
    displayText: citation,
    isDirectLink: false,
  };
}

/**
 * Resolves a citation to a URL based on state abbreviation
 * @param citation - The citation text (e.g., "ARM 37.107.402")
 * @param stateAbbreviation - Two-letter state code (e.g., "MT")
 * @param providedUrl - Optional URL provided by AI or stored in database
 * @returns CitationResult with URL and metadata
 */
export function resolveCitation(
  citation: string | null | undefined,
  stateAbbreviation: string,
  providedUrl?: string | null
): CitationResult {
  // If we have a provided URL, use it
  if (providedUrl) {
    return {
      url: providedUrl,
      displayText: citation || 'View Source',
      isDirectLink: true,
    };
  }

  // No citation to resolve
  if (!citation || citation.trim() === '' || citation === 'N/A') {
    return {
      url: null,
      displayText: citation || 'N/A',
      isDirectLink: false,
    };
  }

  // Try state-specific resolver
  const resolver = stateResolvers[stateAbbreviation.toUpperCase()];
  if (resolver) {
    const result = resolver(citation);
    if (result) return result;
  }

  // Generic fallback: try to detect common patterns
  
  // Cornell Law LII for federal regulations (CFR)
  const cfrMatch = citation.match(/(\d+)\s*C\.?F\.?R\.?\s*§?\s*(\d+)\.(\d+)/i);
  if (cfrMatch) {
    const [, title, part, section] = cfrMatch;
    return {
      url: `https://www.law.cornell.edu/cfr/text/${title}/${part}.${section}`,
      displayText: citation,
      isDirectLink: true,
    };
  }

  // If citation looks like a URL already
  if (citation.match(/^https?:\/\//i)) {
    return {
      url: citation,
      displayText: 'View Source',
      isDirectLink: true,
    };
  }

  // No resolver found - return citation without URL
  return {
    url: null,
    displayText: citation,
    isDirectLink: false,
  };
}

/**
 * Common cannabis regulatory source URLs by state
 * Used as fallbacks when specific citation can't be resolved
 */
export const stateRegulatoryUrls: Record<string, { name: string; url: string }[]> = {
  MT: [
    { name: 'Montana Administrative Rules', url: 'https://rules.mt.gov/' },
    { name: 'Montana DPHHS Cannabis', url: 'https://dphhs.mt.gov/marijuana/' },
    { name: 'Montana DOR Cannabis', url: 'https://mtrevenue.gov/cannabis/' },
  ],
  CO: [
    { name: 'Colorado MED Rules', url: 'https://med.colorado.gov/rules' },
    { name: 'Colorado CCR', url: 'https://www.sos.state.co.us/CCR/NumericalCCRToc.do?deptID=16&agencyID=150' },
  ],
  CA: [
    { name: 'California DCC Regulations', url: 'https://cannabis.ca.gov/cannabis-laws/dcc-regulations/' },
    { name: 'California Code of Regulations', url: 'https://govt.westlaw.com/calregs/' },
  ],
};

export type { CitationResult };
