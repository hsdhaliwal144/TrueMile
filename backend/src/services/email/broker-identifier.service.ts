// src/services/email/broker-identifier.service.ts

/**
 * BrokerIdentifierService - Final Enhanced Version
 * Identifies freight broker emails using domain, keywords, and location patterns
 * Updated with fuzzy domain matching for better detection
 */

interface BrokerInfo {
  name: string;
  domain: string;
  type: 'major' | 'regional' | 'digital';
}

// Known freight brokers (no platforms, just actual brokers)
const KNOWN_BROKERS: BrokerInfo[] = [
  // Top 10 Major Brokers (3PLs)
  { name: 'C.H. Robinson', domain: 'chrobinson.com', type: 'major' },
  { name: 'TQL (Total Quality Logistics)', domain: 'tql.com', type: 'major' },
  { name: 'XPO Logistics', domain: 'xpo.com', type: 'major' },
  { name: 'Coyote Logistics', domain: 'coyote.com', type: 'major' },
  { name: 'Echo Global Logistics', domain: 'echo.com', type: 'major' },
  { name: 'Landstar', domain: 'landstar.com', type: 'major' },
  { name: 'J.B. Hunt', domain: 'jbhunt.com', type: 'major' },
  { name: 'Schneider', domain: 'schneider.com', type: 'major' },
  { name: 'Arrive Logistics', domain: 'arrivelogistics.com', type: 'major' },
  { name: 'RXO (formerly Coyote)', domain: 'rxo.com', type: 'major' },

  // Regional Brokers
  { name: 'Worldwide Express', domain: 'wwex.com', type: 'regional' },
  { name: 'GlobalTranz', domain: 'globaltranz.com', type: 'regional' },
  { name: 'Redwood Logistics', domain: 'redwoodlogistics.com', type: 'regional' },
  { name: 'Armstrong Transport', domain: 'armstrongtransport.com', type: 'regional' },
  { name: 'Nolan Transportation Group', domain: 'ntgfreight.com', type: 'regional' },
  { name: 'Mode Transportation', domain: 'modetransportation.com', type: 'regional' },
  { name: 'Mode Global', domain: 'modeglobal.com', type: 'regional' },
  { name: 'Capstone Logistics', domain: 'capstonelog.com', type: 'regional' },
  { name: 'Covenant Logistics', domain: 'covenantlogistics.com', type: 'regional' },
  { name: 'BNSF Logistics', domain: 'bnsflogistics.com', type: 'regional' },
  { name: 'Allen Lund Company', domain: 'allenlund.com', type: 'regional' },
  { name: 'Tanager Logistics', domain: 'tanagerlogistics.com', type: 'regional' },
  { name: 'First Connect Worldwide', domain: 'firstconnectworldwide.com', type: 'regional' },
  { name: 'Hub Group', domain: 'hubgroup.com', type: 'regional' },
  { name: 'ArcBest Corporation', domain: 'arcb.com', type: 'regional' },
  { name: 'ArcBest Corporation', domain: 'arcbestcorp.com', type: 'regional' },
  { name: 'ATS Inc.', domain: 'atsinc.com', type: 'regional' },
  { name: 'Bay & Bay Transportation', domain: 'bayandbay.com', type: 'regional' },
  { name: 'Priority1 Inc.', domain: 'priority1.com', type: 'regional' },
  { name: 'Scoular', domain: 'scoular.com', type: 'regional' },
  { name: 'Ryan Transportation', domain: 'rtsnational.com', type: 'regional' },
  { name: 'PLS Logistics Services', domain: 'plslogistics.com', type: 'regional' },
  { name: 'Aloe Logistics', domain: 'aloelogistics.com', type: 'regional' },
  { name: 'Ascent Global Logistics', domain: 'ascentgl.com', type: 'regional' },
  { name: 'Ascent Global Logistics', domain: 'ascentglobal.com', type: 'regional' },
  { name: 'TFS Logistics', domain: 'tfslogistics.com', type: 'regional' },
  { name: 'Trinity Logistics', domain: 'trinitylogistics.com', type: 'regional' },
  { name: 'KAG Logistics', domain: 'kaglogistics.com', type: 'regional' },
  
  // Digital Freight Brokers
  { name: 'Convoy', domain: 'convoy.com', type: 'digital' },
  { name: 'Transfix', domain: 'transfix.io', type: 'digital' },
  { name: 'Uber Freight', domain: 'uberfreight.com', type: 'digital' },
  { name: 'Loadsmart', domain: 'loadsmart.com', type: 'digital' },
  { name: 'Freightos', domain: 'freightos.com', type: 'digital' },
  { name: 'Shipwell', domain: 'shipwell.com', type: 'digital' },
  { name: 'project44', domain: 'project44.com', type: 'digital' },
  { name: 'Parade', domain: 'parade.ai', type: 'digital' },
  { name: 'Parade', domain: 'mail.parade.ai', type: 'digital' },
  { name: 'Flock Freight', domain: 'flockfreight.com', type: 'digital' },
  { name: 'next Trucking', domain: 'nexttrucking.com', type: 'digital' },
  { name: 'Crowley', domain: 'crowley.com', type: 'major' },
];

// Comprehensive broker keywords
const BROKER_KEYWORDS = [
  // Load offers & opportunities
  'load available',
  'load offer',
  'load offers',
  'freight opportunity',
  'available load',
  'hot load',
  'urgent load',
  'load tender',
  'backhaul',
  'deadhead',
  'lane opportunity',
  'dedicated lane',
  'opportunity',
  
  // Equipment types
  'reefer',
  'dry van',
  'flatbed',
  'step deck',
  'power only',
  'team driver',
  'solo driver',
  'hazmat',
  
  // Confirmations & documentation
  'rate confirmation',
  'load confirmation',
  'signed rate confirmation',
  'confirmation for load',
  'load status',
  'status update',
  'carrier packet',
  'please provide mc',
  'mc number',
  'dot number',
  'w9 required',
  'insurance certificate',
  'carrier agreement',
  
  // Scheduling
  'pickup scheduled',
  'delivery scheduled',
  'pick up',
  'pickup:',
  'delivery:',
  'pickup time',
  'delivery time',
  'pickup timing',
  'delivery timing',
  
  // Load identifiers
  'load #',
  'load#',
  'bol',
  'bill of lading',
  
  // Pricing
  'rate quote',
  'freight quote',
  'rate per mile',
  'all-in rate',
  'linehaul',
  
  // Location indicators
  'origin:',
  'destination:',
  'from:',
  'to:',
];

// US States (for location detection)
const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

// Major freight cities (for better detection)
const MAJOR_FREIGHT_CITIES = [
  'chicago', 'dallas', 'houston', 'atlanta', 'los angeles', 'phoenix',
  'memphis', 'detroit', 'columbus', 'charlotte', 'indianapolis',
  'seattle', 'denver', 'kansas city', 'nashville', 'miami',
  'san antonio', 'laredo', 'el paso', 'jacksonville', 'cincinnati'
];

// Subject line patterns that indicate broker emails
const BROKER_SUBJECT_PATTERNS = [
  /load\s*#?\d+/i,                              // "Load #12345"
  /\w+,?\s+\w+\s+(?:to|→|-+>)\s+\w+,?\s+\w+/i, // "Chicago, IL to Dallas, TX"
  /confirmation\s+for/i,                        // "Confirmation for..."
  /rate\s+confirmation/i,                       // "Rate confirmation"
  /load\s+status/i,                             // "Load status"
  /freight\s+opportunity/i,                     // "Freight opportunity"
  /\d{5,}\s*[-—]\s*\w+/i,                      // "123456 - Pickup"
  /pick\s*up/i,                                 // "Pickup" or "Pick up"
  /delivery\s+update/i,                         // "Delivery update"
];

export class BrokerIdentifierService {
  /**
   * Calculate similarity between two strings (simple Levenshtein-like approach)
   * Returns a score between 0 and 1 (1 = identical)
   */
  private static calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    // Check if shorter is contained in longer
    if (longer.includes(shorter)) return 0.85;
    
    // Calculate edit distance
    const editDistance = this.levenshteinDistance(str1, str2);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Levenshtein distance calculation
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Check if domain matches or is similar to a known broker domain
   */
  private static findMatchingBroker(domain: string): { broker: BrokerInfo; similarity: number } | null {
    let bestMatch: { broker: BrokerInfo; similarity: number } | null = null;
    
    for (const broker of KNOWN_BROKERS) {
      // Exact match or subdomain
      if (domain === broker.domain || domain.endsWith(`.${broker.domain}`)) {
        return { broker, similarity: 1.0 };
      }
      
      // Remove common email prefixes
      const cleanDomain = domain.replace(/^(mail|smtp|email|webmail|mx|send)\./, '');
      if (cleanDomain === broker.domain || cleanDomain.endsWith(`.${broker.domain}`)) {
        return { broker, similarity: 0.95 };
      }
      
      // Fuzzy matching - check similarity
      const similarity = this.calculateSimilarity(cleanDomain, broker.domain);
      
      // Consider it a match if similarity is high enough (>75%)
      if (similarity >= 0.75) {
        if (!bestMatch || similarity > bestMatch.similarity) {
          bestMatch = { broker, similarity };
        }
      }
      
      // Also check if the broker domain is contained in the email domain
      const brokerBaseName = broker.domain.split('.')[0];
      if (domain.includes(brokerBaseName) && brokerBaseName.length > 4) {
        const containsSimilarity = 0.8;
        if (!bestMatch || containsSimilarity > bestMatch.similarity) {
          bestMatch = { broker, similarity: containsSimilarity };
        }
      }
    }
    
    return bestMatch;
  }

  /**
   * Check if an email is from a known broker
   */
  static identifyBroker(fromEmail: string): {
    isBroker: boolean;
    brokerName: string | null;
    brokerType: string | null;
    confidence: 'high' | 'medium' | 'low';
    similarityScore?: number;
  } {
    if (!fromEmail) {
      return {
        isBroker: false,
        brokerName: null,
        brokerType: null,
        confidence: 'low'
      };
    }

    const emailLower = fromEmail.toLowerCase();
    const domain = this.extractDomain(emailLower);

    if (!domain) {
      return {
        isBroker: false,
        brokerName: null,
        brokerType: null,
        confidence: 'low'
      };
    }

    // Check against known broker domains with fuzzy matching
    const match = this.findMatchingBroker(domain);

    if (match) {
      const confidence = match.similarity >= 0.95 ? 'high' : 
                        match.similarity >= 0.80 ? 'medium' : 'low';
      
      return {
        isBroker: true,
        brokerName: match.broker.name,
        brokerType: match.broker.type,
        confidence,
        similarityScore: match.similarity
      };
    }

    // Check for common broker domain patterns
    if (this.hasBrokerDomainPattern(domain)) {
      return {
        isBroker: true,
        brokerName: this.formatDomainAsName(domain),
        brokerType: 'unknown',
        confidence: 'medium'
      };
    }

    return {
      isBroker: false,
      brokerName: null,
      brokerType: null,
      confidence: 'low'
    };
  }

  /**
   * Analyze email content for broker-related keywords and patterns
   */
  static analyzeContent(subject: string = '', body: string = ''): {
    hasBrokerKeywords: boolean;
    matchedKeywords: string[];
    hasStateReferences: boolean;
    hasCityReferences: boolean;
    subjectMatches: boolean;
    score: number;
  } {
    const content = `${subject} ${body}`.toLowerCase();
    const matchedKeywords: string[] = [];

    // Check broker keywords
    for (const keyword of BROKER_KEYWORDS) {
      if (content.includes(keyword)) {
        matchedKeywords.push(keyword);
      }
    }

    // Check for state abbreviations (strong indicator of freight emails)
    const hasStateReferences = US_STATES.some(state => {
      const pattern = new RegExp(`\\b${state}\\b`, 'i');
      return pattern.test(content);
    });

    // Check for major freight cities
    const hasCityReferences = MAJOR_FREIGHT_CITIES.some(city => 
      content.includes(city)
    );

    // Check subject line patterns
    const subjectMatches = BROKER_SUBJECT_PATTERNS.some(pattern => 
      pattern.test(subject)
    );

    // Calculate score
    let score = matchedKeywords.length;
    if (subjectMatches) score += 3;
    if (hasStateReferences) score += 2;
    if (hasCityReferences) score += 1;

    const hasBrokerKeywords = score >= 2;

    return {
      hasBrokerKeywords,
      matchedKeywords,
      hasStateReferences,
      hasCityReferences,
      subjectMatches,
      score
    };
  }

  /**
   * Combined analysis: domain + content
   */
  static isLikelyBrokerEmail(
    fromEmail: string,
    subject: string = '',
    body: string = ''
  ): {
    isBroker: boolean;
    brokerName: string | null;
    confidence: 'high' | 'medium' | 'low';
    reasoning: string;
  } {
    const domainCheck = this.identifyBroker(fromEmail);
    const contentCheck = this.analyzeContent(subject, body);

    // High confidence: Known broker domain with high similarity
    if (domainCheck.isBroker && domainCheck.confidence === 'high') {
      return {
        isBroker: true,
        brokerName: domainCheck.brokerName,
        confidence: 'high',
        reasoning: `Known broker domain: ${domainCheck.brokerName}${domainCheck.similarityScore ? ` (${Math.round(domainCheck.similarityScore * 100)}% match)` : ''}`
      };
    }

    // High confidence: Strong broker patterns in content
    if (contentCheck.subjectMatches && contentCheck.score >= 4) {
      return {
        isBroker: true,
        brokerName: domainCheck.brokerName,
        confidence: 'high',
        reasoning: `Strong broker patterns: score ${contentCheck.score}`
      };
    }

    // Medium-High: Subject match + states + keywords
    if (contentCheck.subjectMatches && contentCheck.hasStateReferences && contentCheck.matchedKeywords.length >= 2) {
      return {
        isBroker: true,
        brokerName: domainCheck.brokerName,
        confidence: 'high',
        reasoning: `Broker subject + locations + ${contentCheck.matchedKeywords.length} keywords`
      };
    }

    // Medium confidence: Broker-like domain + keywords
    if (domainCheck.confidence === 'medium' && contentCheck.hasBrokerKeywords) {
      return {
        isBroker: true,
        brokerName: domainCheck.brokerName,
        confidence: 'medium',
        reasoning: `Broker-like domain with ${contentCheck.score} freight indicators`
      };
    }

    // Medium confidence: Unknown domain but strong content signals
    if (!domainCheck.isBroker && contentCheck.score >= 4) {
      return {
        isBroker: true,
        brokerName: null,
        confidence: 'medium',
        reasoning: `Strong freight content (score: ${contentCheck.score})`
      };
    }

    // Medium confidence: Subject pattern + reasonable content
    if (contentCheck.subjectMatches && contentCheck.score >= 2) {
      return {
        isBroker: true,
        brokerName: null,
        confidence: 'medium',
        reasoning: `Broker subject pattern + freight keywords`
      };
    }

    // Low confidence or not a broker
    return {
      isBroker: false,
      brokerName: null,
      confidence: 'low',
      reasoning: 'No strong broker indicators'
    };
  }

  /**
   * Extract domain from email address
   */
  private static extractDomain(email: string): string | null {
    const match = email.match(/@(.+)$/);
    return match ? match[1] : null;
  }

  /**
   * Check if domain has common broker naming patterns
   */
  private static hasBrokerDomainPattern(domain: string): boolean {
    const brokerPatterns = [
      'logistics',
      'freight',
      'transport',
      'shipping',
      'cargo',
      'delivery',
      'carrier',
      'trucking',
      'brokerage',
      'supply-chain',
      'supplychain',
      '3pl',
    ];

    return brokerPatterns.some(pattern => domain.includes(pattern));
  }

  /**
   * Format domain as a potential company name
   */
  private static formatDomainAsName(domain: string): string {
    const name = domain
      .replace(/\.(com|net|org|io|co|ai)$/, '')
      .replace(/[-_]/g, ' ')
      .replace(/\bmail\b/gi, '')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    return name;
  }

  /**
   * Get all known broker domains (useful for filtering)
   */
  static getAllKnownBrokerDomains(): string[] {
    return KNOWN_BROKERS.map(b => b.domain);
  }

  /**
   * Get brokers by type
   */
  static getBrokersByType(type: 'major' | 'regional' | 'digital'): BrokerInfo[] {
    return KNOWN_BROKERS.filter(b => b.type === type);
  }

  /**
   * Add a custom broker to the list (for user-specific brokers)
   */
  static addCustomBroker(broker: BrokerInfo): void {
    const exists = KNOWN_BROKERS.find(b => b.domain === broker.domain);
    if (!exists) {
      KNOWN_BROKERS.push(broker);
    }
  }
}