// retroactive-broker-analysis.js
// This will analyze all existing messages and update broker fields
// Run with: node retroactive-broker-analysis.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Known broker domains (updated with full list and fuzzy matching)
const KNOWN_BROKERS = [
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

const BROKER_KEYWORDS = [
  'load available', 'load offer', 'load offers', 'freight opportunity', 
  'available load', 'hot load', 'urgent load', 'load tender', 'backhaul',
  'deadhead', 'lane opportunity', 'dedicated lane', 'opportunity',
  'reefer', 'dry van', 'flatbed', 'step deck', 'power only',
  'team driver', 'solo driver', 'hazmat',
  'rate confirmation', 'load confirmation', 'signed rate confirmation',
  'confirmation for load', 'load status', 'status update', 'carrier packet',
  'please provide mc', 'mc number', 'dot number', 'w9 required',
  'insurance certificate', 'carrier agreement',
  'pickup scheduled', 'delivery scheduled', 'pick up', 'pickup:',
  'delivery:', 'pickup time', 'delivery time',
  'load #', 'load#', 'bol', 'bill of lading',
  'rate quote', 'freight quote', 'rate per mile', 'all-in rate', 'linehaul',
  'origin:', 'destination:', 'from:', 'to:'
];

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

const MAJOR_FREIGHT_CITIES = [
  'chicago', 'dallas', 'houston', 'atlanta', 'los angeles', 'phoenix',
  'memphis', 'detroit', 'columbus', 'charlotte', 'indianapolis',
  'seattle', 'denver', 'kansas city', 'nashville', 'miami',
  'san antonio', 'laredo', 'el paso', 'jacksonville', 'cincinnati'
];

const BROKER_SUBJECT_PATTERNS = [
  /load\s*#?\d+/i,
  /\w+,?\s+\w+\s+(?:to|→|-+>)\s+\w+,?\s+\w+/i,
  /confirmation\s+for/i,
  /rate\s+confirmation/i,
  /load\s+status/i,
  /freight\s+opportunity/i,
  /\d{5,}\s*[-—]\s*\w+/i,
  /pick\s*up/i,
  /delivery\s+update/i,
];

// FUZZY MATCHING FUNCTIONS

function levenshteinDistance(str1, str2) {
  const matrix = [];
  
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

function calculateSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  // Check if shorter is contained in longer
  if (longer.includes(shorter)) return 0.85;
  
  // Calculate edit distance
  const editDistance = levenshteinDistance(str1, str2);
  return (longer.length - editDistance) / longer.length;
}

function findMatchingBroker(domain) {
  let bestMatch = null;
  
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
    const similarity = calculateSimilarity(cleanDomain, broker.domain);
    
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

// MAIN IDENTIFICATION FUNCTIONS

function extractDomain(email) {
  const match = email.match(/@(.+)$/);
  return match ? match[1].toLowerCase() : null;
}

function hasBrokerDomainPattern(domain) {
  const patterns = [
    'logistics', 'freight', 'transport', 'shipping', 'cargo', 
    'delivery', 'carrier', 'trucking', 'brokerage', 'supply-chain',
    'supplychain', '3pl'
  ];
  return patterns.some(pattern => domain.includes(pattern));
}

function formatDomainAsName(domain) {
  return domain
    .replace(/\.(com|net|org|io|co|ai)$/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\bmail\b/gi, '')
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function identifyBroker(fromEmail) {
  if (!fromEmail) {
    return { isBroker: false, brokerName: null, confidence: 'low', similarityScore: 0 };
  }

  const domain = extractDomain(fromEmail);
  if (!domain) {
    return { isBroker: false, brokerName: null, confidence: 'low', similarityScore: 0 };
  }

  // Check against known broker domains with fuzzy matching
  const match = findMatchingBroker(domain);

  if (match) {
    const confidence = match.similarity >= 0.95 ? 'high' : 
                      match.similarity >= 0.80 ? 'medium' : 'low';
    
    return {
      isBroker: true,
      brokerName: match.broker.name,
      confidence,
      similarityScore: match.similarity
    };
  }

  // Check patterns
  if (hasBrokerDomainPattern(domain)) {
    return { 
      isBroker: true, 
      brokerName: formatDomainAsName(domain), 
      confidence: 'medium',
      similarityScore: 0.7
    };
  }

  return { isBroker: false, brokerName: null, confidence: 'low', similarityScore: 0 };
}

function analyzeContent(subject = '', body = '') {
  const content = `${subject} ${body}`.toLowerCase();
  const matchedKeywords = [];
  
  for (const keyword of BROKER_KEYWORDS) {
    if (content.includes(keyword)) {
      matchedKeywords.push(keyword);
    }
  }

  // Check for state abbreviations
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

  return {
    score,
    hasBrokerKeywords: score >= 2,
    matchedKeywords,
    hasStateReferences,
    hasCityReferences,
    subjectMatches
  };
}

function isLikelyBrokerEmail(fromEmail, subject = '', body = '') {
  const domainCheck = identifyBroker(fromEmail);
  const contentCheck = analyzeContent(subject, body);

  // High confidence: Known broker domain with high similarity
  if (domainCheck.isBroker && domainCheck.confidence === 'high') {
    return {
      isBroker: true,
      brokerName: domainCheck.brokerName,
      confidence: 'high'
    };
  }

  // High confidence: Strong broker patterns in content
  if (contentCheck.subjectMatches && contentCheck.score >= 4) {
    return {
      isBroker: true,
      brokerName: domainCheck.brokerName,
      confidence: 'high'
    };
  }

  // Medium-High: Subject match + states + keywords
  if (contentCheck.subjectMatches && contentCheck.hasStateReferences && contentCheck.matchedKeywords.length >= 2) {
    return {
      isBroker: true,
      brokerName: domainCheck.brokerName,
      confidence: 'high'
    };
  }

  // Medium confidence: Broker-like domain + keywords
  if (domainCheck.confidence === 'medium' && contentCheck.hasBrokerKeywords) {
    return {
      isBroker: true,
      brokerName: domainCheck.brokerName,
      confidence: 'medium'
    };
  }

  // Medium confidence: Unknown domain but strong content signals
  if (!domainCheck.isBroker && contentCheck.score >= 4) {
    return {
      isBroker: true,
      brokerName: null,
      confidence: 'medium'
    };
  }

  // Medium confidence: Subject pattern + reasonable content
  if (contentCheck.subjectMatches && contentCheck.score >= 2) {
    return {
      isBroker: true,
      brokerName: null,
      confidence: 'medium'
    };
  }

  return { isBroker: false, brokerName: null, confidence: 'low' };
}

async function analyzeExistingMessages() {
  try {
    console.log('🔄 Starting retroactive broker analysis with fuzzy matching...\n');
    console.log(`📋 Using ${KNOWN_BROKERS.length} known broker domains\n`);

    const messages = await prisma.message.findMany({
      select: {
        id: true,
        from: true,
        subject: true,
        body: true,
        snippet: true,
        isBroker: true,
        brokerName: true
      }
    });

    console.log(`📧 Found ${messages.length} total messages to analyze\n`);

    let analyzed = 0;
    let brokersFound = 0;
    let updated = 0;
    let newlyDetected = 0;

    for (const message of messages) {
      const analysis = isLikelyBrokerEmail(
        message.from,
        message.subject,
        message.body || message.snippet || ''
      );

      const wasNotBrokerBefore = !message.isBroker && analysis.isBroker;
      
      if (analysis.isBroker !== message.isBroker || analysis.brokerName !== message.brokerName) {
        await prisma.message.update({
          where: { id: message.id },
          data: {
            isBroker: analysis.isBroker,
            brokerName: analysis.brokerName
          }
        });
        updated++;
        
        if (wasNotBrokerBefore) {
          newlyDetected++;
        }
      }

      if (analysis.isBroker) {
        brokersFound++;
        if (analysis.confidence === 'high' && wasNotBrokerBefore) {
          console.log(`  ✨ NEW: ${analysis.brokerName || 'Unknown Broker'} - ${message.from}`);
        }
      }

      analyzed++;

      if (analyzed % 100 === 0) {
        console.log(`  Progress: ${analyzed}/${messages.length} (${brokersFound} brokers, ${newlyDetected} newly detected)`);
      }
    }

    console.log('\n✅ Analysis complete!');
    console.log(`   Total analyzed: ${analyzed}`);
    console.log(`   Brokers found: ${brokersFound}`);
    console.log(`   Records updated: ${updated}`);
    console.log(`   Newly detected brokers: ${newlyDetected}`);
    console.log(`   Broker percentage: ${((brokersFound / analyzed) * 100).toFixed(1)}%`);

    const brokerBreakdown = await prisma.message.groupBy({
      by: ['brokerName'],
      where: {
        isBroker: true,
        brokerName: { not: null }
      },
      _count: true,
      orderBy: {
        _count: {
          brokerName: 'desc'
        }
      },
      take: 15
    });

    console.log('\n📊 Top Brokers:');
    brokerBreakdown.forEach((broker, i) => {
      console.log(`   ${i + 1}. ${broker.brokerName}: ${broker._count} emails`);
    });

    // Show confidence breakdown
    const confidenceBreakdown = {
      high: 0,
      medium: 0,
      low: 0
    };

    const reAnalyzeMessages = await prisma.message.findMany({
      where: { isBroker: true },
      select: { from: true, subject: true, body: true, snippet: true }
    });

    reAnalyzeMessages.forEach(msg => {
      const result = isLikelyBrokerEmail(msg.from, msg.subject, msg.body || msg.snippet || '');
      if (result.confidence) {
        confidenceBreakdown[result.confidence]++;
      }
    });

    console.log('\n🎯 Confidence Breakdown:');
    console.log(`   High confidence: ${confidenceBreakdown.high}`);
    console.log(`   Medium confidence: ${confidenceBreakdown.medium}`);
    console.log(`   Low confidence: ${confidenceBreakdown.low}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeExistingMessages();