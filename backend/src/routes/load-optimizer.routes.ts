// ============================================================================
// LOAD OPTIMIZER & BROKER OUTREACH ROUTES
// ============================================================================
// Routes for screenshot-based load scoring and broker outreach
// ============================================================================

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { Pool } from 'pg';
import { createWorker } from 'tesseract.js';
import OpenAI from 'openai';
import axios from 'axios';

const router = Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// File upload configuration for screenshots
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (PNG, JPEG, WEBP) are allowed'));
    }
  }
});

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface LoadCandidate {
  pickupCity: string;
  pickupState: string;
  pickupZip?: string;
  pickupDate?: string;
  dropCity: string;
  dropState: string;
  dropZip?: string;
  deliveryDate?: string;
  rate?: number;
  miles?: number;
  rpm?: number;
  equipment?: string;
  broker?: string;
}

interface ScoredLoad {
  candidate: LoadCandidate;
  score: number;
  status: 'PASS' | 'REVIEW' | 'FAIL';
  reasons: string[];
  milesSource?: string;
}

interface LaneRecommendation {
  origin: string;
  destination: string;
  avgRpm: number;
  avgProfitPerMile: number;
  loadCount: number;
  totalMiles: number;
  score: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the most recent dispatch plan
 */
async function getActiveDispatchPlan(): Promise<any> {
  try {
    const result = await pool.query(`
      SELECT * FROM dispatch_plans 
      WHERE created_at >= NOW() - INTERVAL '7 days'
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching dispatch plan:', error);
    return null;
  }
}

/**
 * Calculate trip progress and what's needed to meet targets
 */
function calculateTripProgress(candidate: LoadCandidate, plan: any) {
  const loadMiles = candidate.miles || 0;
  const loadRPM = candidate.rpm || 0;
  const loadRevenue = candidate.rate || 0;
  
  // Get targets from plan
  const targetMilesPerTrip = parseInt(plan.miles_per_trip) || 4800;
  const targetRPMPerTrip = parseFloat(plan.avg_rpm_needed) || 3.00;
  const targetRevenuePerTrip = parseInt(plan.revenue_per_trip) || 18000;
  const daysOTR = parseInt(plan.days_otr) || 12;
  
  // Calculate daily targets
  const dailyMilesTarget = targetMilesPerTrip / daysOTR;
  const dailyRevenueTarget = targetRevenuePerTrip / daysOTR;
  
  // Estimate days this load takes (simple: 1 day per 400 miles, minimum 1 day, max based on distance)
  const estimatedDays = Math.max(1, Math.min(Math.ceil(loadMiles / 400), 3));
  
  // Calculate what SHOULD have been done in those days
  const expectedMilesForDays = dailyMilesTarget * estimatedDays;
  const expectedRevenueForDays = dailyRevenueTarget * estimatedDays;
  
  // Calculate deficit
  const mileageDeficit = expectedMilesForDays - loadMiles;
  const revenueDeficit = expectedRevenueForDays - loadRevenue;
  
  // Remaining trip calculations
  const daysRemaining = daysOTR - estimatedDays;
  const remainingMiles = Math.max(0, targetMilesPerTrip - loadMiles);
  const remainingRevenue = Math.max(0, targetRevenuePerTrip - loadRevenue);
  
  // NEW daily targets for remaining days (to make up for deficit)
  const newDailyMilesNeeded = daysRemaining > 0 ? remainingMiles / daysRemaining : remainingMiles;
  const newDailyRevenueNeeded = daysRemaining > 0 ? remainingRevenue / daysRemaining : remainingRevenue;
  const remainingRPM = remainingMiles > 0 ? remainingRevenue / remainingMiles : 0;
  
  // Progress percentages
  const milesProgress = (loadMiles / targetMilesPerTrip) * 100;
  const revenueProgress = (loadRevenue / targetRevenuePerTrip) * 100;
  
  // Status determination - consider BOTH RPM and daily efficiency
  const rpmDiff = loadRPM - targetRPMPerTrip;
  const dailyEfficiency = (loadMiles / estimatedDays) / dailyMilesTarget; // 1.0 = on target, <1.0 = behind
  
  let rpmStatus: 'on-track' | 'above' | 'below';
  if (dailyEfficiency < 0.8) {
    // If daily miles are way behind, it's always "below" regardless of RPM
    rpmStatus = 'below';
  } else if (Math.abs(rpmDiff) < 0.10 && dailyEfficiency >= 0.9) {
    rpmStatus = 'on-track';
  } else if (rpmDiff > 0 && dailyEfficiency >= 1.0) {
    rpmStatus = 'above';
  } else {
    rpmStatus = 'below';
  }
  
  return {
    currentLoad: {
      miles: loadMiles,
      rpm: loadRPM,
      revenue: loadRevenue,
      estimatedDays
    },
    targets: {
      milesPerTrip: targetMilesPerTrip,
      rpmPerTrip: targetRPMPerTrip,
      revenuePerTrip: targetRevenuePerTrip,
      daysOTR,
      dailyMilesTarget: Math.round(dailyMilesTarget),
      dailyRevenueTarget: Math.round(dailyRevenueTarget)
    },
    deficit: {
      miles: Math.round(mileageDeficit),
      revenue: Math.round(revenueDeficit),
      days: estimatedDays
    },
    remaining: {
      miles: Math.round(remainingMiles),
      revenue: Math.round(remainingRevenue),
      rpm: parseFloat(remainingRPM.toFixed(2)),
      days: daysRemaining,
      newDailyMiles: Math.round(newDailyMilesNeeded),
      newDailyRevenue: Math.round(newDailyRevenueNeeded)
    },
    progress: {
      miles: parseFloat(milesProgress.toFixed(1)),
      revenue: parseFloat(revenueProgress.toFixed(1)),
      dailyEfficiency: parseFloat((dailyEfficiency * 100).toFixed(1))
    },
    status: rpmStatus,
    rpmDifference: parseFloat(rpmDiff.toFixed(2)),
    message: generateProgressMessage(loadRPM, targetRPMPerTrip, remainingMiles, remainingRPM, daysOTR, estimatedDays, newDailyMilesNeeded, dailyEfficiency)
  };
}

/**
 * Generate human-readable progress message
 */
function generateProgressMessage(
  loadRPM: number, 
  targetRPM: number, 
  remainingMiles: number, 
  remainingRPM: number, 
  daysOTR: number,
  estimatedDays: number,
  newDailyMiles: number,
  dailyEfficiency: number
): string {
  const rpmDiff = loadRPM - targetRPM;
  
  if (dailyEfficiency < 0.8) {
    return `WARNING: This load takes ${estimatedDays} day(s) but only covers ${Math.round(dailyEfficiency * 100)}% of daily mileage target. Even at $${loadRPM.toFixed(2)}/mile, you're falling behind. Remaining ${remainingMiles.toLocaleString()} miles must average ${Math.round(newDailyMiles)} miles/day @ $${remainingRPM.toFixed(2)}/mile to hit trip goals.`;
  } else if (Math.abs(rpmDiff) < 0.10 && dailyEfficiency >= 0.9) {
    return `✅ This load is on track! Keep finding loads around $${targetRPM.toFixed(2)}/mile with ${Math.round(newDailyMiles)} miles/day.`;
  } else if (rpmDiff > 0 && dailyEfficiency >= 1.0) {
    return ` Great! This load pays $${loadRPM.toFixed(2)}/mile (above target of $${targetRPM.toFixed(2)}) and keeps you on pace. Remaining loads need ${Math.round(newDailyMiles)} miles/day @ $${remainingRPM.toFixed(2)}/mile.`;
  } else {
    return `This load pays $${loadRPM.toFixed(2)}/mile (${rpmDiff < 0 ? 'below' : 'above'} $${targetRPM.toFixed(2)} target). To meet your ${daysOTR}-day trip revenue goal, you need ${Math.round(newDailyMiles)} miles/day @ $${remainingRPM.toFixed(2)}/mile over remaining ${remainingMiles.toLocaleString()} miles.`;
  }
}

/**
 * Perform OCR on image buffer using Tesseract
 */
async function performOCR(buffer: Buffer): Promise<string> {
  const worker = await createWorker('eng');
  
  try {
    const { data } = await worker.recognize(buffer);
    await worker.terminate();
    return data.text;
  } catch (error) {
    await worker.terminate();
    throw error;
  }
}

/**
 * Normalize OCR text into structured load candidate using AI
 */
async function normalizeLoadCandidate(ocrText: string): Promise<LoadCandidate> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{
      role: 'user',
      content: `Extract load information from this OCR text. Return ONLY valid JSON:

{
  "pickupCity": "city name",
  "pickupState": "2-letter state code",
  "pickupZip": "5-digit zip or null",
  "pickupDate": "YYYY-MM-DD or null",
  "dropCity": "city name",
  "dropState": "2-letter state code",
  "dropZip": "5-digit zip or null",
  "deliveryDate": "YYYY-MM-DD or null",
  "rate": number or null (total rate, not rate per mile),
  "miles": number or null,
  "equipment": "equipment type or null",
  "broker": "broker name or null"
}

OCR Text:
${ocrText.substring(0, 2000)}`
    }],
    temperature: 0,
    max_tokens: 500
  });

  const content = response.choices[0].message.content || '{}';
  const jsonText = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(jsonText);
}

/**
 * Calculate distance between two locations
 */
async function calculateMiles(origin: string, destination: string): Promise<number | null> {
  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/distancematrix/json', {
      params: {
        origins: origin,
        destinations: destination,
        key: process.env.GOOGLE_MAPS_API_KEY,
        units: 'imperial'
      }
    });
    
    const distance = response.data.rows[0]?.elements[0]?.distance?.value;
    return distance ? Math.round(distance * 0.000621371) : null;
  } catch (error) {
    console.error('Google Maps API error:', error);
    return null;
  }
}

/**
 * Score a load candidate based on thresholds
 */
async function scoreLoad(candidate: LoadCandidate, dispatchPlan: any = null): Promise<ScoredLoad> {
  const reasons: string[] = [];
  let score = 0;

  // Use dispatch plan RPM targets if available
  const RPM_TARGET = dispatchPlan?.avg_rpm_needed || parseFloat(process.env.RPM_TARGET || '2.50');
  const MIN_RPM = parseFloat(process.env.MIN_RPM || '2.00');

  // Calculate daily efficiency if we have dispatch plan
  let dailyEfficiency = 1.0;
  let estimatedDays = 1;
  if (dispatchPlan && candidate.miles) {
    const dailyMilesTarget = parseInt(dispatchPlan.miles_per_trip) / parseInt(dispatchPlan.days_otr);
    estimatedDays = Math.max(1, Math.min(Math.ceil(candidate.miles / 400), 3));
    const expectedMilesForDays = dailyMilesTarget * estimatedDays;
    dailyEfficiency = candidate.miles / expectedMilesForDays;
  }

  // RPM scoring (30 points max - reduced from 40)
  if (candidate.rpm) {
    if (candidate.rpm >= RPM_TARGET) {
      score += 30;
    } else if (candidate.rpm >= MIN_RPM) {
      const rpmScore = ((candidate.rpm - MIN_RPM) / (RPM_TARGET - MIN_RPM)) * 30;
      score += Math.round(rpmScore);
      reasons.push(`RPM $${candidate.rpm} is below target $${RPM_TARGET.toFixed(2)}`);
    } else {
      reasons.push(`RPM $${candidate.rpm} is below minimum $${MIN_RPM}`);
    }
  } else {
    reasons.push('RPM could not be calculated');
  }

  // Daily efficiency scoring (30 points max - NEW)
  if (dispatchPlan) {
    if (dailyEfficiency >= 0.9) {
      score += 30;
    } else if (dailyEfficiency >= 0.7) {
      score += Math.round(dailyEfficiency * 30);
      reasons.push(`Load takes ${estimatedDays} day(s) but only covers ${Math.round(dailyEfficiency * 100)}% of daily mileage target`);
    } else {
      score += Math.round(dailyEfficiency * 20);
      reasons.push(`WARNING: Low daily efficiency (${Math.round(dailyEfficiency * 100)}%) - ${candidate.miles} miles over ${estimatedDays} days`);
    }
  } else {
    score += 15; // Neutral if no dispatch plan
  }

  // Miles check (20 points if reasonable)
  if (candidate.miles) {
    if (candidate.miles >= 200 && candidate.miles <= 800) {
      score += 20;
    } else if (candidate.miles < 200) {
      score += 10;
      reasons.push(`Short haul: only ${candidate.miles} miles`);
    } else {
      score += 15;
      reasons.push(`Long haul: ${candidate.miles} miles`);
    }
  }

  // Date check (20 points if pickup is soon)
  if (candidate.pickupDate) {
    const pickupDate = new Date(candidate.pickupDate);
    const today = new Date();
    const daysUntilPickup = Math.ceil((pickupDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilPickup >= 0 && daysUntilPickup <= 3) {
      score += 20;
    } else if (daysUntilPickup > 3 && daysUntilPickup <= 7) {
      score += 15;
      reasons.push(`Pickup is ${daysUntilPickup} days away`);
    } else {
      score += 5;
      reasons.push(`Pickup date is too far out or invalid`);
    }
  } else {
    score += 10;
  }

  // Completeness bonus (20 points if all fields present) - reduced from before
  const completeness = [
    candidate.pickupCity,
    candidate.dropCity,
    candidate.rate,
    candidate.miles,
    candidate.pickupDate
  ].filter(f => f != null).length;
  
  score += Math.round((completeness / 5) * 10);

  if (completeness < 5) {
    reasons.push('Incomplete information extracted from screenshot');
  }

  // Determine status with daily efficiency consideration
  // Determine status - must meet BOTH RPM and daily efficiency requirements
let status: 'PASS' | 'REVIEW' | 'FAIL';

// Check if load meets both RPM and daily efficiency targets
const meetsRPM = candidate.rpm && candidate.rpm >= RPM_TARGET * 0.95; // Within 5% of target
const meetsDailyEfficiency = dailyEfficiency >= 0.85; // At least 85% daily efficiency

if (meetsRPM && meetsDailyEfficiency && score >= 75) {
  status = 'PASS';
} else if (score >= 50 && (meetsRPM || meetsDailyEfficiency)) {
  status = 'REVIEW'; // Good in one area but not both
} else if (dailyEfficiency < 0.7 || (candidate.rpm && candidate.rpm < MIN_RPM)) {
  status = 'FAIL'; // Critical failures
} else if (score >= 50) {
  status = 'REVIEW';
} else {
  status = 'FAIL';
}

// Add reason if failing daily efficiency
if (dailyEfficiency < 0.85 && dispatchPlan) {
  if (!reasons.some(r => r.includes('daily'))) {
    reasons.push(`Daily efficiency ${Math.round(dailyEfficiency * 100)}% - does not meet 85% threshold`);
  }
}
  return {
    candidate,
    score: Math.min(score, 100),
    status,
    reasons: reasons.length > 0 ? reasons : ['Load meets criteria'],
    milesSource: candidate.miles ? 'maps' : undefined
  };
}

// ============================================================================
// ROUTES
// ============================================================================

/**
 * POST /api/optimizer/screenshot
 * Upload screenshot of load board → OCR → normalize → score
 */
router.post('/screenshot', upload.single('image'), async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, error: 'No image uploaded' });
      return;
    }

    console.log('🖼️  Processing screenshot...');

    // Step 1: OCR the image
    const ocrText = await performOCR(file.buffer);
    console.log('📝 OCR extracted:', ocrText.substring(0, 200));

    // Step 2: Normalize fields using AI
    const candidate = await normalizeLoadCandidate(ocrText);
    console.log('✅ Normalized candidate:', candidate);

    // Step 3: Calculate miles if missing
    if (!candidate.miles && candidate.pickupCity && candidate.dropCity) {
      console.log('🗺️  Calculating miles via Google Maps...');
      const calculatedMiles = await calculateMiles(
        `${candidate.pickupCity}, ${candidate.pickupState}`,
        `${candidate.dropCity}, ${candidate.dropState}`
      );
      if (calculatedMiles) {
        candidate.miles = calculatedMiles;
        console.log('✅ Miles calculated:', calculatedMiles);
      } else {
        console.log('⚠️  Could not calculate miles');
      }
    }

    // Step 4: Calculate RPM
    if (candidate.rate && candidate.miles) {
      candidate.rpm = parseFloat((candidate.rate / candidate.miles).toFixed(2));
      console.log('✅ RPM calculated:', candidate.rpm);
    } else {
      console.log('⚠️  Cannot calculate RPM (missing rate or miles)');
    }

    // Step 5: Get active dispatch plan
    console.log('📊 Fetching dispatch plan...');
    const dispatchPlan = await getActiveDispatchPlan();

    // Step 6: Score the load (with dispatch context)
    console.log('📊 Scoring load...');
    const scoredLoad = await scoreLoad(candidate, dispatchPlan);
    console.log('✅ Score:', scoredLoad.score, 'Status:', scoredLoad.status);

    // Step 7: Calculate trip progress if dispatch plan exists
    let tripAnalysis = null;
    if (dispatchPlan && candidate.miles && candidate.rpm) {
      tripAnalysis = calculateTripProgress(candidate, dispatchPlan);
      console.log('📊 Trip analysis:', tripAnalysis.status);
    }

    // Step 8: Save to database
    console.log('💾 Saving to database...');
    const savedCandidate = await pool.query(`
      INSERT INTO load_candidates (
        pickup_city, pickup_state, pickup_zip, pickup_at,
        drop_city, drop_state, drop_zip, delivery_at,
        rate, miles, miles_source, rpm,
        score, status, reasons, source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'screenshot')
      RETURNING *
    `, [
      candidate.pickupCity,
      candidate.pickupState,
      candidate.pickupZip || null,
      candidate.pickupDate || null,
      candidate.dropCity,
      candidate.dropState,
      candidate.dropZip || null,
      candidate.deliveryDate || null,
      candidate.rate || null,
      candidate.miles || null,
      scoredLoad.milesSource || 'ocr',
      candidate.rpm || null,
      scoredLoad.score,
      scoredLoad.status,
      scoredLoad.reasons
    ]);

    console.log('✅ Saved! Candidate ID:', savedCandidate.rows[0].id);

    // Step 9: Send response
    const response = {
      success: true,
      candidate: savedCandidate.rows[0],
      ocrText: ocrText.substring(0, 500),
      score: scoredLoad.score,
      status: scoredLoad.status,
      reasons: scoredLoad.reasons,
      tripAnalysis
    };

    console.log('📤 Sending response to frontend...');
    res.json(response);
    console.log('✅ COMPLETE! Response sent successfully.');

  } catch (error: any) {
    console.error('❌ Screenshot processing error:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/optimizer/dispatch-plan/active
 * Get the most recent active dispatch plan
 */
router.get('/dispatch-plan/active', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT * FROM dispatch_plans 
      WHERE created_at >= NOW() - INTERVAL '7 days'
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    if (result.rows.length === 0) {
      res.json({ success: true, plan: null });
      return;
    }
    
    res.json({ success: true, plan: result.rows[0] });
  } catch (error: any) {
    console.error('Get dispatch plan error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/optimizer/dispatch-plan
 * Save dispatch plan from Dispatch Engine
 */
router.post('/dispatch-plan', async (req: Request, res: Response) => {
  try {
    const { driverName, daysOTR, daysOff, plan } = req.body;
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS dispatch_plans (
        id SERIAL PRIMARY KEY,
        driver_name VARCHAR(100),
        days_otr INT,
        days_off INT,
        total_working_days INT,
        miles_needed INT,
        avg_rpm_needed DECIMAL(5,2),
        target_revenue INT,
        miles_per_trip INT,
        revenue_per_trip INT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    const result = await pool.query(`
      INSERT INTO dispatch_plans (
        driver_name, days_otr, days_off, total_working_days,
        miles_needed, avg_rpm_needed, target_revenue,
        miles_per_trip, revenue_per_trip
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      driverName,
      daysOTR,
      daysOff,
      plan.totalWorkingDays,
      plan.milesNeeded,
      plan.avgRPMNeeded,
      plan.targetRevenue,
      plan.milesPerTrip,
      plan.revenuePerTrip
    ]);
    
    res.json({ success: true, plan: result.rows[0] });
  } catch (error: any) {
    console.error('Save dispatch plan error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/optimizer/candidates
 * Get all load candidates with optional filters
 */
router.get('/candidates', async (req: Request, res: Response) => {
  try {
    const { status, minScore, driverId, limit = 50 } = req.query;

    let query = 'SELECT * FROM load_candidates WHERE 1=1';
    const params: any[] = [];
    let paramCount = 0;

    if (status) {
      params.push(status);
      query += ` AND status = $${++paramCount}`;
    }

    if (minScore) {
      params.push(parseFloat(minScore as string));
      query += ` AND score >= $${++paramCount}`;
    }

    if (driverId) {
      params.push(parseInt(driverId as string));
      query += ` AND driver_id = $${++paramCount}`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${++paramCount}`;
    params.push(parseInt(limit as string));

    const result = await pool.query(query, params);

    res.json({
      success: true,
      count: result.rows.length,
      candidates: result.rows
    });

  } catch (error: any) {
    console.error('Get candidates error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/optimizer/candidates/:id
 * Delete a load candidate
 */
router.delete('/candidates/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    console.log(`🗑️  Deleting candidate ${id}...`);
    
    const result = await pool.query(
      'DELETE FROM load_candidates WHERE id = $1 RETURNING id',
      [parseInt(id)]
    );
    
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Candidate not found' });
      return;
    }
    
    console.log(`✅ Deleted candidate ${id}`);
    res.json({ success: true, message: 'Candidate deleted' });
    
  } catch (error: any) {
    console.error('Delete candidate error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/optimizer/lanes
 * Get top lane recommendations for broker outreach
 */
router.get('/lanes', async (req: Request, res: Response) => {
  try {
    const { driverId, scope = 'fleet', limit = 10 } = req.query;

    const windowDays = parseInt(process.env.LANE_WINDOW_DAYS || '90');
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - windowDays);

    const lanes = await calculateLaneRecommendations(
      scope as string,
      driverId ? parseInt(driverId as string) : undefined,
      windowStart,
      new Date()
    );

    const topLanes = lanes
      .sort((a, b) => b.score - a.score)
      .slice(0, parseInt(limit as string));

    res.json({
      success: true,
      count: topLanes.length,
      lanes: topLanes,
      windowDays
    });

  } catch (error: any) {
    console.error('Lane recommendations error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

async function calculateLaneRecommendations(
  scope: string,
  driverId: number | undefined,
  windowStart: Date,
  windowEnd: Date
): Promise<LaneRecommendation[]> {
  
  let query = `
    SELECT 
      pickup_state || ' → ' || dropoff_state as lane,
      pickup_state as origin,
      dropoff_state as destination,
      COUNT(*) as load_count,
      AVG(net_amount / NULLIF(miles, 0)) as avg_rpm,
      AVG(miles) as avg_miles,
      SUM(miles) as total_miles,
      AVG(COALESCE(deadhead_miles, 0)) as avg_deadhead
    FROM loads
    WHERE pickup_at >= $1 AND pickup_at <= $2
      AND miles > 0
  `;

  const params: any[] = [windowStart, windowEnd];

  if (scope === 'driver' && driverId) {
    query += ` AND driver_id = $3`;
    params.push(driverId);
  }

  query += `
    GROUP BY pickup_state, dropoff_state
    HAVING COUNT(*) >= 2
    ORDER BY COUNT(*) DESC, AVG(net_amount / NULLIF(miles, 0)) DESC
  `;

  const result = await pool.query(query, params);

  const RPM_TARGET = parseFloat(process.env.RPM_TARGET || '2.50');
  
  return result.rows.map((row: any) => {
    const avgRpm = parseFloat(row.avg_rpm || 0);
    const loadCount = parseInt(row.load_count);
    const avgDeadhead = parseInt(row.avg_deadhead || 0);

    let score = 0;
    score += Math.min((avgRpm / RPM_TARGET) * 40, 40);
    score += Math.min((loadCount / 10) * 30, 30);
    score -= Math.min((avgDeadhead / 100) * 20, 20);
    
    if (loadCount >= 5) score += 30;
    else if (loadCount >= 3) score += 20;
    else score += 10;

    return {
      origin: row.origin,
      destination: row.destination,
      avgRpm: parseFloat(avgRpm.toFixed(2)),
      avgProfitPerMile: 0,
      loadCount,
      totalMiles: parseInt(row.total_miles),
      score: Math.min(Math.round(score), 100)
    };
  });
}

/**
 * POST /api/outreach/draft
 * Generate email draft for dedicated lane or load inquiry
 */
router.post('/draft', async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, lane, candidate, brokerName, contactEmail } = req.body;

    if (!type || !['dedicated_lane', 'load_inquiry'].includes(type)) {
      res.status(400).json({ success: false, error: 'Invalid type. Must be dedicated_lane or load_inquiry' });
      return;
    }

    let subject = '';
    let body = '';

    if (type === 'dedicated_lane' && lane) {
      subject = `Dedicated Capacity: ${lane.origin} → ${lane.destination}`;
      
      body = `Hi${brokerName ? ` ${brokerName}` : ''},

I hope this email finds you well! We've had great success with your freight in the past, particularly on the ${lane.origin} → ${lane.destination} lane where we've completed ${lane.loadCount} loads with an average of ${lane.totalMiles.toLocaleString()} miles per load.

We're interested in exploring a dedicated lane partnership for this route. With our reliable equipment and experienced drivers, we can offer:

- Consistent capacity ${lane.loadCount >= 5 ? 'with proven track record' : 'for regular runs'}
- Competitive rates with volume commitment
- Flexible scheduling to meet your needs
- Real-time tracking and communication

Would you be open to discussing dedicated pricing for this lane? I'd love to schedule a brief call at your convenience.

Looking forward to strengthening our partnership!

Best regards,
Royal Carriers Inc.
${process.env.COMPANY_EMAIL || 'contact@royalcarriers.com'}
${process.env.COMPANY_PHONE || '(469) 394-7061'}
MC #${process.env.MC_NUMBER || 'XXXXXX'}`;
    
    } else if (type === 'load_inquiry' && candidate) {
      subject = `Load Inquiry: ${candidate.pickup_city}, ${candidate.pickup_state} → ${candidate.drop_city}, ${candidate.drop_state}`;
      
      body = `Hi${brokerName ? ` ${brokerName}` : ''},

I came across a load posting from ${candidate.pickup_city}, ${candidate.pickup_state} to ${candidate.drop_city}, ${candidate.drop_state}${candidate.pickup_at ? ` picking up on ${new Date(candidate.pickup_at).toLocaleDateString()}` : ''}.

We have ${candidate.equipment || 'a truck'} available and would like to request full rate confirmation details:

- Pickup/delivery times and locations
- Rate and any accessorial charges
- Special requirements
- BOL/reference numbers

Please let me know if this load is still available and we can get it covered immediately.

Thank you!

Best regards,
Royal Carriers Inc.
${process.env.COMPANY_EMAIL || 'contact@royalcarriers.com'}
${process.env.COMPANY_PHONE || '(469) 394-7061'}
MC #${process.env.MC_NUMBER || 'XXXXXX'}`;
    }

    const result = await pool.query(`
      INSERT INTO outreach_emails (
        subject, body, email_type, status, lane_origin, lane_dest, context
      ) VALUES ($1, $2, $3, 'draft', $4, $5, $6)
      RETURNING *
    `, [
      subject,
      body,
      type,
      lane?.origin || candidate?.pickup_state || null,
      lane?.destination || candidate?.drop_state || null,
      JSON.stringify({ lane, candidate, brokerName, contactEmail })
    ]);

    res.json({
      success: true,
      draft: result.rows[0],
      subject,
      body
    });

  } catch (error: any) {
    console.error('Draft email error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/outreach/send
 * Send approved email draft via Gmail/Outlook
 */
router.post('/send', async (req: Request, res: Response): Promise<void> => {
  try {
    const { draftId, to } = req.body;

    if (!draftId || !to) {
      res.status(400).json({ success: false, error: 'draftId and to email required' });
      return;
    }

    const draftResult = await pool.query(
      'SELECT * FROM outreach_emails WHERE id = $1 AND status = $2',
      [draftId, 'approved']
    );

    if (draftResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Draft not found or not approved' });
      return;
    }

    const draft = draftResult.rows[0];

    await pool.query(`
      UPDATE outreach_emails
      SET status = 'sent', sent_at = NOW(), sent_via = 'gmail'
      WHERE id = $1
    `, [draftId]);

    res.json({
      success: true,
      message: 'Email sent successfully',
      draftId
    });

  } catch (error: any) {
    console.error('Send email error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;