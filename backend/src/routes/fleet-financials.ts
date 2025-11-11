import express, { Request, Response } from 'express';
import { Pool } from 'pg';

const router = express.Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

router.get('/summary', async (req: Request, res: Response) => {
  try {
    // Get all expenses
    const expensesResult = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN category = 'fuel' THEN amount ELSE 0 END), 0) as fuel_expenses,
        COALESCE(SUM(CASE WHEN category != 'fuel' THEN amount ELSE 0 END), 0) as other_expenses,
        COALESCE(SUM(amount), 0) as total_expenses
      FROM expenses
    `);

    // Get all loads (revenue)
    const loadsResult = await pool.query(`
      SELECT 
        COALESCE(SUM(net_amount), 0) as gross_revenue,
        COALESCE(SUM(miles), 0) as total_miles,
        COUNT(*) as total_loads
      FROM loads
      WHERE net_amount > 0
    `);

    // Get driver performance
    const driversResult = await pool.query(`
      SELECT 
        d.name,
        COALESCE(SUM(l.net_amount), 0) as revenue,
        COALESCE(SUM(CASE WHEN e.category = 'fuel' THEN e.amount ELSE 0 END), 0) as variable_expenses,
        COALESCE(SUM(CASE WHEN e.category != 'fuel' THEN e.amount ELSE 0 END), 0) as fixed_expenses,
        COALESCE(SUM(l.miles), 0) as miles,
        COUNT(l.id) as loads
      FROM drivers d
      LEFT JOIN loads l ON d.id = l.driver_id
      LEFT JOIN expenses e ON d.id = e.driver_id
      GROUP BY d.id, d.name
      HAVING SUM(l.net_amount) > 0
    `);

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