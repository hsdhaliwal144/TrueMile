// ============================================================================
// DETERMINISTIC EXPENSE CATEGORIZATION RULES
// ============================================================================
// Version: 1.0
// Description: Substring-based categorization for credit card and bank
//              statement line items. First match wins.
// ============================================================================

export interface CategoryRule {
  category: string;
  includes: string[];
  description?: string;
}

export const CATEGORY_RULES: CategoryRule[] = [
  // ========== FUEL ==========
  {
    category: 'fuel',
    includes: [
      'pilot', 'flying j', "love's", 'loves', 'ta ', 'petro', 'travelcenters',
      'ambest', 'kwik trip', 'casey', 'speedway', 'shell', 'exxon', 'chevron',
      'bp ', 'valero', 'circle k', 'maverik', 'racetrack', 'wawa', 'sheetz',
      'turkey hill', '76 ', 'arco', 'conoco', 'phillips 66', 'marathon',
      'sunoco', 'citgo', 'fuel', 'diesel', 'gas station'
    ],
    description: 'Fuel and diesel purchases'
  },

  // ========== TOLLS & ROAD FEES ==========
  {
    category: 'toll',
    includes: [
      'toll', 'ezpass', 'ez pass', 'e-zpass', 'prepass', 'bestpass',
      'turnpike', 'toll road', 'toll plaza', 'ipass', 'sunpass', 'txtag',
      'fastrak', 'fax fax', 'peach pass'
    ],
    description: 'Tolls, EZPass, and road fees'
  },

  // ========== INSURANCE ==========
  {
    category: 'insurance',
    includes: [
      'progressive', 'geico', 'state farm', 'allstate', 'farmers',
      'liberty mutual', 'nationwide', 'usaa', 'travelers', 'american family',
      'safeco', 'metlife', 'insurance', 'cis ', 'canal', 'great west'
    ],
    description: 'Insurance premiums'
  },

  // ========== MAINTENANCE & REPAIRS ==========
  {
    category: 'maintenance',
    includes: [
      'freightliner', 'volvo', 'kenworth', 'peterbilt', 'international',
      'mack trucks', 'western star', 'penske', 'ryder', 'ta service',
      'speedco', 'midas', 'goodyear', 'bridgestone', 'michelin',
      'firestone', 'tire', 'brake', 'repair', 'maintenance', 'oil change',
      'mechanic', 'truck service', 'lube', 'filter', 'parts'
    ],
    description: 'Truck and trailer maintenance'
  },

  // ========== LUMPER FEES ==========
  {
    category: 'lumper',
    includes: [
      'capstone', 'lump', '3pl', 'warehouse', 'unload', 'loading fee',
      'lumper fee', 'comchek lumper'
    ],
    description: 'Lumper and unloading fees'
  },

  // ========== ELD & LOGBOOK ==========
  {
    category: 'logbook',
    includes: [
      'eld', 'keeptruckin', 'keep truckin', 'motive', 'omnitracs', 'samsara',
      'geotab', 'verizon connect', 'fleetmatics', 'teletrac', 'peoplenet',
      'qualcomm', 'electronic log'
    ],
    description: 'ELD and logbook services'
  },

  // ========== LOAD BOARDS ==========
  {
    category: 'load_board',
    includes: [
      'dat', 'truckstop', 'truck stop', '123loadboard', 'direct freight',
      'load board', 'getloaded', 'internet truckstop'
    ],
    description: 'Load board subscriptions'
  },

  // ========== COMPLIANCE & PERMITS ==========
  {
    category: 'compliance',
    includes: [
      'dot', 'ifta', 'ucr', 'irp', 'permit', 'fmcsa', 'drug test', 'screening',
      'background check', 'medical card', 'hazmat', 'oversize', 'registration'
    ],
    description: 'DOT compliance and permits'
  },

  // ========== TRUCK PAYMENTS ==========
  {
    category: 'truck_payment',
    includes: [
      'ally', 'volvo financial', 'daimler', 'paccar', 'navistar financial',
      'truck loan', 'semi payment', 'freightliner financial', 'chase auto'
    ],
    description: 'Truck loan/lease payments'
  },

  // ========== TRAILER PAYMENTS ==========
  {
    category: 'trailer_payment',
    includes: [
      'stoughton', 'wabash', 'great dane', 'utility trailer', 'hyundai translead',
      'trailer payment', 'trailer lease', 'vanguard trailer'
    ],
    description: 'Trailer loan/lease payments'
  },

  // ========== INTEREST & FINANCE CHARGES ==========
  {
    category: 'interest',
    includes: [
      'interest charge', 'finance charge', 'late fee', 'interest expense'
    ],
    description: 'Interest and finance charges'
  },

  // ========== PAYROLL TAX ==========
  {
    category: 'payroll_tax',
    includes: [
      'payroll tax', 'fica', 'social security', 'medicare tax', '941',
      'unemployment', 'state ui', 'edd', 'workforce'
    ],
    description: 'Payroll and employment taxes'
  },

  // ========== BUSINESS TAX ==========
  {
    category: 'business_tax',
    includes: [
      'franchise tax', 'sales tax', 'use tax', 'heavy vehicle use tax',
      'form 2290', 'business tax', 'income tax'
    ],
    description: 'Business taxes and fees'
  },

  // ========== ACCOUNTING & CPA ==========
  {
    category: 'cpa',
    includes: [
      'cpa', 'accountant', 'bookkeeping', 'quickbooks', 'accounting',
      'tax prep', 'payroll service', 'adp', 'paychex', 'gusto'
    ],
    description: 'Accounting and bookkeeping services'
  },

  // ========== TMS & SOFTWARE ==========
  {
    category: 'tms',
    includes: [
      'tms', 'axon', 'mcleod', 'transportation management', 'fleet software',
      'dispatch', 'routing software'
    ],
    description: 'TMS and dispatch software'
  },

  // ========== PARKING ==========
  {
    category: 'parking',
    includes: [
      'parking', 'truck stop parking', 'overnight parking', 'parking fee'
    ],
    description: 'Parking fees'
  },

  // ========== SCALES & WEIGHING ==========
  {
    category: 'scales',
    includes: [
      'cat scale', 'weigh station', 'scale', 'certified weight'
    ],
    description: 'Scale and weighing fees'
  },

  // ========== COMMUNICATIONS ==========
  {
    category: 'communications',
    includes: [
      'verizon', 'at&t', 'att ', 't-mobile', 'sprint', 'phone', 'cellular',
      'internet', 'hotspot', 'wifi'
    ],
    description: 'Phone and internet services'
  },

  // ========== SUPPLIES ==========
  {
    category: 'supplies',
    includes: [
      'walmart', 'target', 'home depot', 'lowes', "lowe's", 'office depot',
      'staples', 'amazon', 'office supply', 'cleaning', 'supplies'
    ],
    description: 'General supplies and materials'
  },

  // ========== FOOD & MEALS ==========
  {
    category: 'food',
    includes: [
      'mcdonald', 'burger king', 'wendy', 'taco bell', 'chipotle', 'subway',
      'arby', 'kfc', 'popeyes', 'chick-fil-a', 'sonic', 'panera', 'starbucks',
      'dunkin', 'restaurant', 'diner', 'cafe', 'food', 'meal'
    ],
    description: 'Food and meals (some may be non-deductible)'
  },

  // ========== LODGING ==========
  {
    category: 'lodging',
    includes: [
      'motel', 'hotel', 'inn', 'holiday inn', 'marriott', 'hilton',
      'best western', 'super 8', 'days inn', 'comfort', 'airbnb', 'lodging'
    ],
    description: 'Hotel and lodging expenses'
  },

  // ========== SAFETY EQUIPMENT ==========
  {
    category: 'safety',
    includes: [
      'fire extinguisher', 'safety vest', 'reflective', 'first aid',
      'emergency kit', 'triangle', 'safety equipment'
    ],
    description: 'Safety equipment and supplies'
  },

  // ========== MISCELLANEOUS (FALLBACK) ==========
  {
    category: 'misc',
    includes: [],
    description: 'Miscellaneous expenses (default fallback)'
  }
];

/**
 * Categorize an expense based on merchant name or memo
 * @param merchant - Merchant name from transaction
 * @param memo - Optional memo/description
 * @returns Category string
 */
export function categorizeExpense(merchant: string, memo?: string): string {
  const searchText = `${merchant || ''} ${memo || ''}`.toLowerCase();
  
  // Iterate through rules and return first match
  for (const rule of CATEGORY_RULES) {
    if (rule.includes.length === 0) continue; // Skip fallback rule
    
    for (const keyword of rule.includes) {
      if (searchText.includes(keyword.toLowerCase())) {
        return rule.category;
      }
    }
  }
  
  // Default fallback
  return 'misc';
}

/**
 * Get all available expense categories
 */
export function getCategories(): string[] {
  return CATEGORY_RULES.map(rule => rule.category);
}

/**
 * Get description for a category
 */
export function getCategoryDescription(category: string): string {
  const rule = CATEGORY_RULES.find(r => r.category === category);
  return rule?.description || category;
}

/**
 * Batch categorize multiple expenses
 */
export function categorizeBatch(
  expenses: Array<{ merchant: string; memo?: string }>
): Array<{ merchant: string; memo?: string; category: string }> {
  return expenses.map(expense => ({
    ...expense,
    category: categorizeExpense(expense.merchant, expense.memo)
  }));
}

// Export for use in API routes
export default {
  CATEGORY_RULES,
  categorizeExpense,
  getCategories,
  getCategoryDescription,
  categorizeBatch
};
