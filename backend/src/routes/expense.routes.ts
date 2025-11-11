// ============================================================================
// PROFIT ENGINE - EXPENSE TRACKING & PROFIT CALCULATION
// ============================================================================
// Import credit card statements → Auto-categorize → Calculate real profit
// ============================================================================

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { Pool } from 'pg';
import { parse } from 'csv-parse/sync';

const router = Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// File upload configuration for CSV
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// ============================================================================
// EXPENSE CATEGORIES & AUTO-DETECTION
// ============================================================================

interface ExpenseCategory {
  name: string;
  keywords: string[];
  color: string;
}

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  {
    name: 'FUEL',
    keywords: ['PILOT', 'LOVES', 'LOVE\'S', 'TA ', 'PETRO', 'FLYING J', 'SPEEDWAY', 'SHELL', 'EXXON', 'BP '],
    color: '#dc2626'
  },
  {
    name: 'TOLLS',
    keywords: ['NTTA', 'TOLL', 'TURNPIKE', 'E-ZPASS', 'IPASS', 'SUNPASS'],
    color: '#ea580c'
  },
  {
    name: 'MAINTENANCE',
    keywords: ['TIRE', 'AUTOZONE', 'O\'REILLY', 'REPAIR', 'LUBE', 'OIL CHANGE', 'TRAILER', 'PARTS'],
    color: '#d97706'
  },
  {
    name: 'UNLOADING',
    keywords: ['UNLOAD', 'LUMPER', 'WAREHOUSE'],
    color: '#ca8a04'
  },
  {
    name: 'ELD',
    keywords: ['EZLOGZ', 'EZ LOGZ', 'EZLOG', 'MOTIVE', 'SAMSARA', 'GEOTAB', 'KEEPTRUCKIN', 'KEEP TRUCKIN'],
    color: '#65a30d'
  },
  {
    name: 'LOAD_BOARD',
    keywords: ['DAT SOLUTIONS', 'DAT ', 'TRUCKSTOP', 'TRUCK STOP'],
    color: '#0891b2'
  },
  {
    name: 'PREPASS',
    keywords: ['PREPASS', 'PRE-PASS', 'PRE PASS', 'ALLIAPHOENIX', 'SAFETY'],
    color: '#0891b2'
  },
  {
    name: 'FOOD',
    keywords: [
      'ARBY', 'MCDONALD', 'WENDY', 'BURGER', 'TACO', 'SUBWAY', 'DENNY', 'RESTAURANT',
      'CHIPOTLE', 'PANERA', 'KFC', 'POPEYES', 'CHICK-FIL-A', 'CHICK FIL A', 'CHICKFILA',
      'JIMMY JOHN', 'PIZZA', 'STARBUCKS', 'DUNKIN', 'SONIC', 'JACK IN THE BOX',
      'HARDEES', 'CARL\'S JR', 'CARLS JR', 'WHATABURGER', 'IN-N-OUT', 'FIVE GUYS',
      'CRACKER BARREL', 'WAFFLE HOUSE', 'IHOP', 'APPLEBEE', 'CHILI\'S', 'OLIVE GARDEN',
      'PANDA EXPRESS', 'QDOBA', 'MOE\'S', 'BUFFALO WILD', 'WING STOP'
    ],
    color: '#16a34a'
  },
  {
    name: 'IFTA',
    keywords: ['IFTA'],
    color: '#0891b2'
  },
  {
    name: 'COMPLIANCE',
    keywords: ['SIMPLEX GROUP', 'COMPLIANCE'],
    color: '#0891b2'
  },
  {
    name: 'PERMITS',
    keywords: ['PERMIT', 'LICENSE'],
    color: '#0891b2'
  },
  {
    name: 'SUPPLIES',
    keywords: ['WALMART', 'WAL-MART', 'TARGET', 'HOME DEPOT', 'HARBOR FREIGHT'],
    color: '#0284c7'
  },
  {
    name: 'SCALES',
    keywords: ['SCALE', 'WEIGH STATION', 'CAT SCALE'],
    color: '#ea580c'
  },
  {
    name: 'FEES',
    keywords: ['FEE', 'CHARGE', 'SERVICE'],
    color: '#7c3aed'
  },
  {
    name: 'OTHER',
    keywords: [],
    color: '#64748b'
  }
];

function categorizeExpense(description: string, amount?: number): string {
  const upperDesc = description.toUpperCase();
  
  for (const category of EXPENSE_CATEGORIES) {
    for (const keyword of category.keywords) {
      if (upperDesc.includes(keyword)) {
        // If it's FUEL but under $100, categorize as OTHER (misc)
        if (category.name === 'FUEL' && amount && amount < 100) {
          return 'OTHER';
        }
        return category.name;
      }
    }
  }
  
  return 'OTHER';
}

function mapCategoryToExpenseType(category: string): string {
  const mapping: Record<string, string> = {
    'FUEL': 'fuel',
    'TOLLS': 'toll',
    'MAINTENANCE': 'repair',
    'UNLOADING': 'lumper',
    'ELD': 'eld',
    'LOAD_BOARD': 'load_board',
    'PREPASS': 'prepass',
    'FOOD': 'food',
    'IFTA': 'ifta',
    'COMPLIANCE': 'compliance',
    'PERMITS': 'permits',
    'SUPPLIES': 'misc',
    'SCALES': 'scales',
    'FEES': 'misc',
    'OTHER': 'misc'
  };
  
  return mapping[category] || 'misc';
}

function isPayment(description: string, amount: number): boolean {
  const upperDesc = description.toUpperCase();
  
  if (amount < 0) return true;
  
  const paymentKeywords = [
    'AUTOPAY PAYMENT',
    'PAYMENT - THANK YOU',
    'PAYMENT RECEIVED',
    'ONLINE PAYMENT',
    'MOBILE PAYMENT'
  ];
  
  return paymentKeywords.some(keyword => upperDesc.includes(keyword));
}

// ============================================================================
// FUZZY NAME MATCHING
// ============================================================================

function fuzzyMatchDriver(cardMemberName: string, driverName: string): boolean {
  if (!cardMemberName || !driverName) return false;
  
  const normalize = (str: string) => str.toUpperCase().trim().replace(/[^A-Z]/g, '');
  
  const cardNorm = normalize(cardMemberName);
  const driverNorm = normalize(driverName);
  
  // Exact match
  if (cardNorm === driverNorm) return true;
  
  // First name match
  const cardFirst = cardNorm.split(/\s+/)[0];
  const driverFirst = driverNorm.split(/\s+/)[0];
  if (cardFirst && driverFirst && cardFirst === driverFirst) return true;
  
  // Contains match (driver name contains card member name or vice versa)
  if (driverNorm.includes(cardNorm) || cardNorm.includes(driverNorm)) return true;
  
  return false;
}

// ============================================================================
// CSV IMPORT ENDPOINT WITH CARD MAPPING & BATCH TRACKING
// ============================================================================

router.post('/import', upload.single('csv'), async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, error: 'No CSV file uploaded' });
      return;
    }

    console.log('📊 Processing expense CSV...');

    let csvText = file.buffer.toString('utf-8');
    
    // Skip title rows like "activity (2)" - find the actual header line
    const lines = csvText.split('\n');
    let headerIndex = 0;
    for (let i = 0; i < Math.min(lines.length, 5); i++) {
      const line = lines[i].toLowerCase();
      if (line.includes('date') && line.includes('amount') && line.includes('account')) {
        headerIndex = i;
        break;
      }
    }
    
    // Rebuild CSV starting from header line
    if (headerIndex > 0) {
      csvText = lines.slice(headerIndex).join('\n');
    }
    
    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true
    });

    console.log(`📝 Found ${records.length} transactions`);

    // Get all drivers for fuzzy matching
    const driversResult = await pool.query('SELECT id, name FROM drivers');
    const allDrivers = driversResult.rows;

    const transactions: any[] = [];
    const uniqueCards = new Map<string, any>();
    const skipped: any[] = [];
    let paymentTotal = 0;

    for (const record of records) {
      const amount = parseFloat(record.Amount || record.amount || '0');
      const description = record.Description || record.description || '';
      const date = record.Date || record.date || '';
      const cardMember = record['Card Member'] || record.card_member || '';
      const accountNum = record['Account #'] || record.account || record.accountNum || '';
      
      if (isPayment(description, amount)) {
        skipped.push({ date, description, amount, reason: 'Payment/Credit' });
        if (amount < 0) paymentTotal += Math.abs(amount);
        continue;
      }

      if (amount <= 0) continue;

      const category = categorizeExpense(description, amount);

      // Skip FEES - factoring is calculated dynamically on frontend
      if (category === 'FEES') {
        skipped.push({ date, description, amount, reason: 'Fee (calculated separately)' });
        continue;
      }

      const last4 = accountNum.replace(/[\*\s\-]/g, '').slice(-4);
      
      if (last4 && last4.length === 4) {
        if (!uniqueCards.has(last4)) {
          uniqueCards.set(last4, {
            last4,
            cardMember,
            samples: [],
            autoMatchedDriver: null
          });
        }
        
        const cardInfo = uniqueCards.get(last4);
        if (cardInfo.samples.length < 3) {
          cardInfo.samples.push({
            cardMember,
            description: description.trim(),
            amount
          });
        }
      }

      transactions.push({
        date: new Date(date),
        description: description.trim(),
        amount,
        category,
        cardMember: cardMember?.trim() || '',
        last4,
        raw_data: record
      });
    }

    console.log(`💳 Found ${uniqueCards.size} unique cards`);
    console.log(`✅ ${transactions.length} valid transactions`);
    console.log(`⏭️  ${skipped.length} transactions skipped (payments: $${paymentTotal.toLocaleString()})`);

    // Check for unmapped cards and attempt auto-matching
    const unmappedCards: any[] = [];
    const autoMappedCards: Map<string, number> = new Map();
    
    for (const [last4, cardInfo] of uniqueCards) {
      if (!last4) continue;
      
      // Check if card already exists in DB
      const existingCard = await pool.query(
        'SELECT id, driver_id FROM cards WHERE last4 = $1',
        [last4]
      );

      if (existingCard.rows.length > 0 && existingCard.rows[0].driver_id) {
        // Card already mapped
        autoMappedCards.set(last4, existingCard.rows[0].driver_id);
        console.log(`✅ Card *${last4} already mapped to driver ID ${existingCard.rows[0].driver_id}`);
        continue;
      }

      // Try auto-matching based on card member name
      let matchedDriver = null;
      if (cardInfo.cardMember) {
        for (const driver of allDrivers) {
          if (fuzzyMatchDriver(cardInfo.cardMember, driver.name)) {
            matchedDriver = driver;
            console.log(`🎯 Auto-matched card *${last4} (${cardInfo.cardMember}) → ${driver.name}`);
            break;
          }
        }
      }

      if (matchedDriver) {
        // Auto-map the card
        if (existingCard.rows.length > 0) {
          await pool.query(
            'UPDATE cards SET driver_id = $1, nickname = $2, updated_at = NOW() WHERE last4 = $3',
            [matchedDriver.id, `*${last4} - ${matchedDriver.name}`, last4]
          );
        } else {
          await pool.query(`
            INSERT INTO cards (last4, driver_id, brand, nickname, created_at, updated_at)
            VALUES ($1, $2, 'other', $3, NOW(), NOW())
          `, [last4, matchedDriver.id, `*${last4} - ${matchedDriver.name}`]);
        }
        autoMappedCards.set(last4, matchedDriver.id);
      } else {
        // No match found - needs manual mapping
        unmappedCards.push({
          last4,
          cardMember: cardInfo.cardMember,
          samples: cardInfo.samples
        });
      }
    }

    // Return unmapped cards if any
    if (unmappedCards.length > 0) {
      console.log(`⚠️  ${unmappedCards.length} unmapped cards - pausing import`);
      console.log(`✅ ${autoMappedCards.size} cards auto-mapped`);
      
      res.json({
        success: false,
        needsMapping: true,
        unmappedCards,
        autoMappedCount: autoMappedCards.size,
        pendingTransactionCount: transactions.length
      });
      return;
    }

    // All cards mapped - proceed with import
    console.log('✅ All cards mapped - importing expenses...');
    
    // CREATE BATCH RECORD
    const batchResult = await pool.query(`
      INSERT INTO upload_batches (batch_type, file_count, description, metadata)
      VALUES ('expenses', 1, $1, $2)
      RETURNING id
    `, [
      `Expenses CSV: ${file.originalname}`,
      JSON.stringify({ 
        filename: file.originalname,
        cards: Array.from(uniqueCards.keys())
      })
    ]);
    
    const batchId = batchResult.rows[0].id;
    console.log(`📦 Created batch #${batchId} for expense import`);
    
    let imported = 0;
    let skippedNoDriver = 0;

    if (transactions.length > 0) {
      for (const txn of transactions) {
        // Get driver ID from auto-mapped cards or existing card mapping
        let driverId: number | null = null;
        let cardId: number | null = null;

        if (autoMappedCards.has(txn.last4)) {
          driverId = autoMappedCards.get(txn.last4) || null;
          
          // Get card ID
          const cardResult = await pool.query(
            'SELECT id FROM cards WHERE last4 = $1',
            [txn.last4]
          );
          if (cardResult.rows.length > 0) {
            cardId = cardResult.rows[0].id;
          }
        } else {
          const cardResult = await pool.query(
            'SELECT id, driver_id FROM cards WHERE last4 = $1',
            [txn.last4]
          );

          if (cardResult.rows.length > 0 && cardResult.rows[0].driver_id) {
            cardId = cardResult.rows[0].id;
            driverId = cardResult.rows[0].driver_id;
          }
        }

        if (!driverId) {
          console.log(`⏭️  Skipping transaction - no driver for card *${txn.last4}`);
          skippedNoDriver++;
          continue;
        }

        await pool.query(`
          INSERT INTO expenses (
            txn_at, description, amount, category, driver_name, source, raw_data, expense_type,
            driver_id, card_id, batch_id
          ) VALUES ($1, $2, $3, $4, $5, 'cc', $6, $7, $8, $9, $10)
          RETURNING id
        `, [
          txn.date,
          txn.description,
          txn.amount,
          txn.category,
          txn.cardMember || null,
          txn.raw_data,
          mapCategoryToExpenseType(txn.category),
          driverId,
          cardId,
          batchId
        ]);

        imported++;
      }
    }

    // Update batch with final count
    await pool.query(
      'UPDATE upload_batches SET record_count = $1 WHERE id = $2',
      [imported, batchId]
    );

    console.log(`✅ Import complete: ${imported} expenses imported, ${skippedNoDriver} skipped (no driver)`);

    const categoryTotals: Record<string, number> = {};
    transactions.forEach(exp => {
      categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
    });

    res.json({
      success: true,
      imported,
      autoMappedCount: autoMappedCards.size,
      skipped: skipped.length + skippedNoDriver,
      paymentTotal,
      categoryBreakdown: categoryTotals,
      dateRange: {
        start: transactions[transactions.length - 1]?.date,
        end: transactions[0]?.date
      }
    });

  } catch (error: any) {
    console.error('❌ CSV import error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// CARD MAPPING ENDPOINT
// ============================================================================

router.post('/map-cards', async (req: Request, res: Response): Promise<void> => {
  try {
    const { mappings } = req.body;

    if (!mappings || !Array.isArray(mappings) || mappings.length === 0) {
      res.status(400).json({ success: false, error: 'mappings array required' });
      return;
    }

    console.log(`💳 Mapping ${mappings.length} cards...`);

    for (const mapping of mappings) {
      const { last4, driverId, driverName, skip } = mapping;

      // Skip this card if requested
      if (skip) {
        console.log(`⏭️  Skipping card *${last4} (family member/other)`);
        
        // Update or create card with null driver_id to mark as "skip"
        const existingCard = await pool.query(
          'SELECT id FROM cards WHERE last4 = $1',
          [last4]
        );

        if (existingCard.rows.length > 0) {
          await pool.query(
            'UPDATE cards SET driver_id = NULL, nickname = $1, updated_at = NOW() WHERE last4 = $2',
            [`*${last4} - SKIPPED`, last4]
          );
        } else {
          await pool.query(`
            INSERT INTO cards (last4, driver_id, brand, nickname, created_at, updated_at)
            VALUES ($1, NULL, 'other', $2, NOW(), NOW())
          `, [last4, `*${last4} - SKIPPED`]);
        }
        
        continue;
      }

      if (!last4 || !driverId) {
        console.log(`⚠️  Skipping invalid mapping:`, mapping);
        continue;
      }

      const existingCard = await pool.query(
        'SELECT id FROM cards WHERE last4 = $1',
        [last4]
      );

      if (existingCard.rows.length > 0) {
        await pool.query(
          'UPDATE cards SET driver_id = $1, nickname = $2, updated_at = NOW() WHERE last4 = $3',
          [driverId, `*${last4} - ${driverName}`, last4]
        );
        console.log(`✅ Updated card *${last4} → ${driverName}`);
      } else {
        await pool.query(`
          INSERT INTO cards (last4, driver_id, brand, nickname, created_at, updated_at)
          VALUES ($1, $2, 'other', $3, NOW(), NOW())
        `, [last4, driverId, `*${last4} - ${driverName}`]);
        console.log(`✅ Created card *${last4} → ${driverName}`);
      }
    }

    res.json({
      success: true,
      message: `Mapped ${mappings.length} cards`
    });

  } catch (error: any) {
    console.error('❌ Card mapping error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// EXPENSE QUERIES & ANALYSIS
// ============================================================================

router.get('/', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, category, driverName, limit = 100 } = req.query;

    let query = 'SELECT * FROM expenses WHERE 1=1';
    const params: any[] = [];
    let paramCount = 0;

    if (startDate) {
      params.push(startDate);
      query += ` AND date >= $${++paramCount}`;
    }

    if (endDate) {
      params.push(endDate);
      query += ` AND date <= $${++paramCount}`;
    }

    if (category) {
      params.push(category);
      query += ` AND category = $${++paramCount}`;
    }

    if (driverName) {
      params.push(driverName);
      query += ` AND driver_name ILIKE $${++paramCount}`;
    }

    query += ` ORDER BY date DESC LIMIT $${++paramCount}`;
    params.push(parseInt(limit as string));

    const result = await pool.query(query, params);

    res.json({
      success: true,
      count: result.rows.length,
      expenses: result.rows
    });

  } catch (error: any) {
    console.error('Get expenses error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/summary', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    let query = `
      SELECT 
        category,
        COUNT(*) as transaction_count,
        SUM(amount) as total_amount,
        AVG(amount) as avg_amount,
        MIN(date) as earliest_date,
        MAX(date) as latest_date
      FROM expenses
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramCount = 0;

    if (startDate) {
      params.push(startDate);
      query += ` AND date >= $${++paramCount}`;
    }

    if (endDate) {
      params.push(endDate);
      query += ` AND date <= $${++paramCount}`;
    }

    query += `
      GROUP BY category
      ORDER BY total_amount DESC
    `;

    const result = await pool.query(query, params);

    const summaryWithColors = result.rows.map(row => ({
      ...row,
      color: EXPENSE_CATEGORIES.find(c => c.name === row.category)?.color || '#64748b'
    }));

    res.json({
      success: true,
      summary: summaryWithColors
    });

  } catch (error: any) {
    console.error('Get summary error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/by-driver', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    let query = `
      SELECT 
        driver_name,
        COUNT(*) as transaction_count,
        SUM(amount) as total_amount,
        AVG(amount) as avg_amount
      FROM expenses
      WHERE driver_name IS NOT NULL
    `;
    
    const params: any[] = [];
    let paramCount = 0;

    if (startDate) {
      params.push(startDate);
      query += ` AND date >= $${++paramCount}`;
    }

    if (endDate) {
      params.push(endDate);
      query += ` AND date <= $${++paramCount}`;
    }

    query += `
      GROUP BY driver_name
      ORDER BY total_amount DESC
    `;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      drivers: result.rows
    });

  } catch (error: any) {
    console.error('Get by driver error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'DELETE FROM expenses WHERE id = $1 RETURNING id',
      [parseInt(id)]
    );
    
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Expense not found' });
      return;
    }
    
    res.json({ success: true, message: 'Expense deleted' });
    
  } catch (error: any) {
    console.error('Delete expense error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/bulk/all', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, driverName } = req.query;

    let query = 'DELETE FROM expenses WHERE 1=1';
    const params: any[] = [];
    let paramCount = 0;

    if (startDate) {
      params.push(startDate);
      query += ` AND date >= $${++paramCount}`;
    }

    if (endDate) {
      params.push(endDate);
      query += ` AND date <= $${++paramCount}`;
    }

    if (driverName) {
      params.push(driverName);
      query += ` AND driver_name ILIKE $${++paramCount}`;
    }

    query += ' RETURNING id';

    const result = await pool.query(query, params);

    res.json({
      success: true,
      deleted: result.rows.length,
      message: `Deleted ${result.rows.length} expense(s)`
    });

  } catch (error: any) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// PROFIT CALCULATION
// ============================================================================

router.get('/profit/overview', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, driverId } = req.query;

    let revenueQuery = `
      SELECT 
        COUNT(*) as load_count,
        SUM(net_amount) as total_revenue,
        SUM(miles) as total_miles,
        AVG(net_amount / NULLIF(miles, 0)) as avg_rpm
      FROM loads
      WHERE 1=1
    `;
    
    const revenueParams: any[] = [];
    let paramCount = 0;

    if (startDate) {
      revenueParams.push(startDate);
      revenueQuery += ` AND pickup_at >= $${++paramCount}`;
    }

    if (endDate) {
      revenueParams.push(endDate);
      revenueQuery += ` AND pickup_at <= $${++paramCount}`;
    }

    if (driverId) {
      revenueParams.push(parseInt(driverId as string));
      revenueQuery += ` AND driver_id = $${++paramCount}`;
    }

    const revenueResult = await pool.query(revenueQuery, revenueParams);

    let expenseQuery = `
      SELECT 
        COUNT(*) as expense_count,
        SUM(amount) as total_expenses,
        category,
        SUM(amount) as category_total
      FROM expenses
      WHERE 1=1
    `;
    
    const expenseParams: any[] = [];
    paramCount = 0;

    if (startDate) {
      expenseParams.push(startDate);
      expenseQuery += ` AND date >= $${++paramCount}`;
    }

    if (endDate) {
      expenseParams.push(endDate);
      expenseQuery += ` AND date <= $${++paramCount}`;
    }

    expenseQuery += ` GROUP BY category`;

    const expenseResult = await pool.query(expenseQuery, expenseParams);

    const revenue = parseFloat(revenueResult.rows[0]?.total_revenue || '0');
    const totalExpenses = expenseResult.rows.reduce((sum, row) => sum + parseFloat(row.category_total || '0'), 0);
    const profit = revenue - totalExpenses;
    const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;

    res.json({
      success: true,
      overview: {
        revenue,
        expenses: totalExpenses,
        profit,
        profitMargin: parseFloat(profitMargin.toFixed(2)),
        loadCount: parseInt(revenueResult.rows[0]?.load_count || '0'),
        totalMiles: parseInt(revenueResult.rows[0]?.total_miles || '0'),
        avgRpm: parseFloat(revenueResult.rows[0]?.avg_rpm || '0')
      },
      expenseBreakdown: expenseResult.rows.map(row => ({
        category: row.category,
        amount: parseFloat(row.category_total),
        color: EXPENSE_CATEGORIES.find(c => c.name === row.category)?.color || '#64748b'
      }))
    });

  } catch (error: any) {
    console.error('Profit overview error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/profit/by-load', async (req: Request, res: Response) => {
  try {
    const { limit = 20 } = req.query;

    const loadsQuery = `
      SELECT 
        l.id,
        l.pickup_city,
        l.pickup_state,
        l.dropoff_city,
        l.dropoff_state,
        l.pickup_at,
        l.net_amount as revenue,
        l.miles,
        l.net_amount / NULLIF(l.miles, 0) as rpm,
        l.driver_id,
        d.name as driver_name
      FROM loads l
      LEFT JOIN drivers d ON l.driver_id = d.id
      WHERE l.net_amount > 0
      ORDER BY l.pickup_at DESC
      LIMIT $1
    `;

    const loadsResult = await pool.query(loadsQuery, [parseInt(limit as string)]);

    const loadProfits = await Promise.all(
      loadsResult.rows.map(async (load) => {
        const expenseQuery = `
          SELECT 
            category,
            SUM(amount) as total
          FROM expenses
          WHERE date BETWEEN $1::date - INTERVAL '3 days' AND $1::date + INTERVAL '3 days'
          GROUP BY category
        `;
        
        const expenseResult = await pool.query(expenseQuery, [load.pickup_at]);
        
        const expenses = expenseResult.rows.reduce((sum, row) => sum + parseFloat(row.total || '0'), 0);
        const profit = load.revenue - expenses;
        const profitMargin = load.revenue > 0 ? (profit / load.revenue) * 100 : 0;

        return {
          ...load,
          expenses,
          profit,
          profitMargin: parseFloat(profitMargin.toFixed(2)),
          profitPerMile: load.miles > 0 ? profit / load.miles : 0
        };
      })
    );

    res.json({
      success: true,
      count: loadProfits.length,
      loads: loadProfits
    });

  } catch (error: any) {
    console.error('Profit by load error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;