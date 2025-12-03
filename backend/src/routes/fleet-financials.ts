import express, { Request, Response } from 'express';
import { Pool } from 'pg';

const router = express.Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

router.get('/summary', async (req: Request, res: Response) => {
  try {
    const period = req.query.period || 'ytd';
    const factoringRate = parseFloat(req.query.factoringRate as string) || 0;

    // Calculate date range based on period
    const now = new Date();
    const year = now.getFullYear();
    let startDate: Date;
    let endDate: Date = now;

    switch (period) {
      case 'q1':
        startDate = new Date(year, 0, 1);
        endDate = new Date(year, 2, 31);
        break;
      case 'q2':
        startDate = new Date(year, 3, 1);
        endDate = new Date(year, 5, 30);
        break;
      case 'q3':
        startDate = new Date(year, 6, 1);
        endDate = new Date(year, 8, 30);
        break;
      case 'q4':
        startDate = new Date(year, 9, 1);
        endDate = new Date(year, 11, 31);
        break;
      case 'ytd':
      default:
        startDate = new Date(year, 0, 1);
        endDate = now;
        break;
    }

    // Get all expenses within date range
    const expensesResult = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN category = 'fuel' THEN amount ELSE 0 END), 0) as fuel_expenses,
        COALESCE(SUM(CASE WHEN category != 'fuel' THEN amount ELSE 0 END), 0) as other_expenses,
        COALESCE(SUM(amount), 0) as total_expenses
      FROM expenses
      WHERE date >= $1 AND date <= $2
    `, [startDate, endDate]);

    // Get all loads (Revenue) filtered by pickup_date
    const loadsResult = await pool.query(`
      SELECT 
        COALESCE(SUM(net_amount), 0) as gross_revenue,
        COALESCE(SUM(miles), 0) as total_miles,
        COUNT(*) as total_loads
      FROM loads
      WHERE net_amount > 0
        AND pickup_date >= $1
        AND pickup_date <= $2
    `, [startDate, endDate]);

    // Get driver Performance filtered by pickup_date
    const driversResult = await pool.query(`
      SELECT 
        d.name,
        COALESCE(SUM(l.net_amount), 0) as revenue,
        COALESCE(SUM(CASE WHEN e.category = 'fuel' THEN e.amount ELSE 0 END), 0) as variable_expenses,
        COALESCE(SUM(CASE WHEN e.category != 'fuel' THEN e.amount ELSE 0 END), 0) as fixed_expenses,
        COALESCE(SUM(l.miles), 0) as miles,
        COUNT(l.id) as loads
      FROM drivers d
      LEFT JOIN loads l ON d.id = l.driver_id AND l.pickup_date >= $1 AND l.pickup_date <= $2
      LEFT JOIN expenses e ON d.id = e.driver_id AND e.date >= $1 AND e.date <= $2
      GROUP BY d.id, d.name
      HAVING SUM(l.net_amount) > 0
    `, [startDate, endDate]);

    const expenses = expensesResult.rows[0];
    const loads = loadsResult.rows[0];
    
    const grossRevenue = parseFloat(loads.gross_revenue) || 0;
    const totalExpenses = parseFloat(expenses.total_expenses) || 0;
    const netProfit = grossRevenue - totalExpenses;
    const totalMiles = parseFloat(loads.total_miles) || 0;
    
    const avgRPM = totalMiles > 0 ? grossRevenue / totalMiles : 0;
    const avgCPM = totalMiles > 0 ? totalExpenses / totalMiles : 0;
    const fixedCPM = totalMiles > 0 ? parseFloat(expenses.other_expenses) / totalMiles : 0;
    const variableCPM = totalMiles > 0 ? parseFloat(expenses.fuel_expenses) / totalMiles : 0;
    const profitMargin = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;

    const drivers = driversResult.rows.map((d: any) => {
      const driverRevenue = parseFloat(d.revenue) || 0;
      const driverFixedExpenses = parseFloat(d.fixed_expenses) || 0;
      const driverVariableExpenses = parseFloat(d.variable_expenses) || 0;
      const driverMiles = parseFloat(d.miles) || 0;
      const driverProfit = driverRevenue - driverFixedExpenses - driverVariableExpenses;
      
      return {
        name: d.name,
        revenue: driverRevenue,
        fixedExpenses: driverFixedExpenses,
        variableExpenses: driverVariableExpenses,
        profit: driverProfit,
        miles: driverMiles,
        rpm: driverMiles > 0 ? driverRevenue / driverMiles : 0,
        cpm: driverMiles > 0 ? (driverFixedExpenses + driverVariableExpenses) / driverMiles : 0,
        loads: parseInt(d.loads) || 0
      };
    });

    res.json({
      success: true,
      grossRevenue,
      totalExpenses,
      netProfit,
      totalMiles,
      avgRPM,
      avgCPM,
      fixedCPM,
      variableCPM,
      profitMargin,
      factoringRate,
      drivers
    });

  } catch (error: any) {
    console.error('Error fetching fleet financials summary:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch summary data',
      details: error.message 
    });
  }
});

export default router;