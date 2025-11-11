import express, { Request, Response } from 'express';
import multer from 'multer';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// POST /api/upload - Handle file uploads
router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const file = req.file;
    const fileType = file.originalname.split('.').pop()?.toLowerCase();
    const buffer = file.buffer;

    let metrics: any = {};
    let summary = '';

    if (fileType === 'csv') {
      // Parse CSV
      const text = buffer.toString('utf-8');
      const result = Papa.parse(text, { header: true });
      
      // Detect file type based on headers
      const headers = Object.keys(result.data[0] || {}).map(h => h.toLowerCase());
      
      if (headers.some(h => h.includes('fuel') || h.includes('gallon') || h.includes('diesel'))) {
        // Fuel receipts
        const totalFuel = result.data.reduce((sum: number, row: any) => {
          const amount = parseFloat(Object.values(row).find((v: any) => 
            typeof v === 'string' && v.replace(/[$,]/g, '').match(/^\d+\.?\d*$/)
          )?.toString().replace(/[$,]/g, '') || '0');
          return sum + amount;
        }, 0);
        
        metrics = { fuelCost: totalFuel };
        summary = `Processed ${result.data.length} fuel receipts totaling $${totalFuel.toFixed(2)}.`;
        
      } else if (headers.some(h => h.includes('rate') || h.includes('load') || h.includes('revenue') || h.includes('miles'))) {
        // Rate confirmations
        let totalRevenue = 0;
        let totalMiles = 0;
        let loads = 0;

        result.data.forEach((row: any) => {
          const revenue = parseFloat(Object.values(row).find((v: any) => 
            typeof v === 'string' && v.replace(/[$,]/g, '').match(/^\d+\.?\d*$/)
          )?.toString().replace(/[$,]/g, '') || '0');
          
          const miles = parseFloat(Object.values(row).find((v: any, idx: number) => 
            typeof v === 'string' && headers[idx]?.includes('mile') && v.match(/^\d+\.?\d*$/)
          )?.toString() || '0');

          if (revenue > 0) {
            totalRevenue += revenue;
            loads++;
          }
          if (miles > 0) {
            totalMiles += miles;
          }
        });
        
        metrics = {
          loadsPerMonth: loads,
          milesPerMonth: totalMiles || (loads * 500) // Estimate miles if not provided
        };
        summary = `Processed ${loads} rate confirmations with ${totalMiles.toLocaleString()} miles and $${totalRevenue.toLocaleString()} revenue.`;
        
      } else if (headers.some(h => h.includes('expense') || h.includes('cost') || h.includes('amount'))) {
        // General expenses
        const categoryIndex = headers.findIndex(h => h.includes('category') || h.includes('type'));
        const amountIndex = headers.findIndex(h => h.includes('amount') || h.includes('cost') || h.includes('total'));
        
        const expensesByCategory: any = {};
        
        result.data.forEach((row: any) => {
          const values = Object.values(row);
          const category = (values[categoryIndex] as string || '').toLowerCase();
          const amount = parseFloat((values[amountIndex] as string || '0').replace(/[$,]/g, ''));
          
          if (category.includes('fuel')) {
            expensesByCategory.fuelCost = (expensesByCategory.fuelCost || 0) + amount;
          } else if (category.includes('insurance')) {
            expensesByCategory.insurance = (expensesByCategory.insurance || 0) + amount;
          } else if (category.includes('maintenance') || category.includes('repair')) {
            expensesByCategory.maintenance = (expensesByCategory.maintenance || 0) + amount;
          } else {
            expensesByCategory.otherExpenses = (expensesByCategory.otherExpenses || 0) + amount;
          }
        });
        
        metrics = expensesByCategory;
        const total = Object.values(expensesByCategory).reduce((a: any, b: any) => a + b, 0) as number;
        summary = `Processed expense report with $${total.toLocaleString()} in total expenses.`;
      }
      
    } else if (fileType === 'xlsx' || fileType === 'xls') {
      // Parse Excel
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(firstSheet);
      
      if (data.length > 0) {
        const headers = Object.keys(data[0]).map(h => h.toLowerCase());
        
        // Use similar logic as CSV
        if (headers.some(h => h.includes('fuel'))) {
          const totalFuel = data.reduce((sum: number, row: any) => {
            const amount = parseFloat(Object.values(row).find((v: any) => 
              typeof v === 'number' || (typeof v === 'string' && v.match(/^\$?\d+\.?\d*$/))
            )?.toString().replace(/[$,]/g, '') || '0');
            return sum + amount;
          }, 0);
          metrics = { fuelCost: totalFuel };
          summary = `Processed Excel with ${data.length} fuel entries totaling $${totalFuel.toFixed(2)}.`;
        } else {
          summary = `Processed Excel file with ${data.length} rows. Please tell me what this data represents!`;
        }
      }
      
    } else if (fileType === 'pdf') {
      // PDF parsing is complex - for MVP, ask user
      summary = `Received PDF. Is this a rate confirmation, fuel receipt, or invoice? I'll help you enter the data.`;
    } else {
      return res.status(400).json({ error: 'Unsupported file type' });
    }

    return res.json({
      success: true,
      summary,
      metrics
    });

  } catch (error: any) {
    console.error('Upload error:', error);
    return res.status(500).json({ 
      error: 'Failed to process file',
      details: error.message 
    });
  }
});

export default router;
