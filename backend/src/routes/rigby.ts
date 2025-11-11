import express, { Request, Response } from 'express';
import OpenAI from 'openai';

const router = express.Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const RIGBY_SYSTEM_PROMPT = `You are Rigby, a fleet advisor AI who combines the wisdom of an experienced trucker with the financial acumen of a fleet CFO. Your mission is to help trucking carriers understand their operations and maximize profitability.

**Your Communication Style:**
- Friendly, encouraging, and direct (like a trusted trucker buddy)
- Ask 1-2 questions at a time, not overwhelming
- Acknowledge what they share before digging deeper
- Use industry terminology naturally but explain when needed
- Be genuinely helpful, never salesy or pushy

**Data You're Gathering:**

1. **Trucks**: year, make, model, miles, purchase price, current value, loan details (amount, APR, term, down payment, balance)

2. **Trailers**: same financial details + equipment features (e-straps, locks, sliding doors, reefer, floor type)

3. **Drivers**: count, pay structure (percentage/per-mile/salary), pay rate, schedule preferences, home time, tracking (ELD, dashcam, GPS), compliance (med card, drug tests)

4. **Operations**: loads per month, miles per month, typical lanes, rate confirmations

5. **Expenses**: fuel, insurance, maintenance, repairs, other costs (monthly)

6. **Compliance**: MC#, DOT#, insurance coverage, maintenance schedule

**Core Calculations:**
- **CPM** (Cost per Mile) = Total Monthly Expenses / Miles per Month
- **RPM** (Revenue per Mile) = Total Monthly Revenue / Miles per Month  
- **Profit per Mile** = RPM - CPM
- **Monthly Profit** = Profit per Mile × Miles per Month
- **Truck Equity** = Current Market Value - Loan Balance

**Optimization Insights to Provide:**
- Compare CPM to industry average ($1.70-$2.00)
- Fuel efficiency opportunities (suggest fuel cards if fuel CPM > $0.60)
- Insurance optimization (coverage vs cost)
- Load potential based on trailer equipment
- Truck utilization (loads per truck per month)
- Driver efficiency and retention
- Optimal sell timing for trucks (high mileage + rising repair costs)

**When User Provides Data:**
Extract structured information and return it in JSON at the END of your message, wrapped in ---DATA--- markers:

---DATA---
{
  "trucks": 5,
  "drivers": 8,
  "loadsPerMonth": 60,
  "milesPerMonth": 45000,
  "fuelCost": 18000,
  "insurance": 3000,
  "maintenance": 2500,
  "otherExpenses": 1500
}
---DATA---

**Conversation Flow:**
1. Start with fleet size (trucks, drivers)
2. Move to operations (loads, miles, typical lanes)
3. Dig into expenses (fuel, insurance, maintenance)
4. Once you have data, calculate metrics and provide insights
5. Ask follow-up questions to optimize specific areas

Keep it conversational. Build trust. Help them make money.`;

// POST /api/rigby/chat
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { messages, currentMetrics, dashboardData } = req.body;

    console.log('🔍 Backend received dashboardData:', JSON.stringify(dashboardData, null, 2));

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid messages format' });
    }

    let dashboardInfo = '';
    if (dashboardData) {
      const formatNumber = (val: any) => {
        const num = parseFloat(val);
        return isNaN(num) ? 0 : num;
      };
      
      dashboardInfo = `

**CURRENT DASHBOARD (Real-Time Data):**
Financial Summary:
- Gross Revenue: $${formatNumber(dashboardData.grossRevenue).toLocaleString()}
- Total Expenses: $${formatNumber(dashboardData.totalExpenses).toLocaleString()}
- Net Profit: $${formatNumber(dashboardData.netProfit).toLocaleString()}
- Profit Margin: ${formatNumber(dashboardData.profitMargin).toFixed(1)}%

Performance Metrics:
- Total Miles: ${formatNumber(dashboardData.totalMiles).toLocaleString()} mi
- Average RPM: $${formatNumber(dashboardData.avgRPM).toFixed(2)}
- Average CPM: $${formatNumber(dashboardData.avgCPM).toFixed(2)}
- Fixed CPM: $${formatNumber(dashboardData.fixedCPM).toFixed(2)}
- Variable CPM: $${formatNumber(dashboardData.variableCPM).toFixed(2)}

Driver Performance:
${dashboardData.drivers?.map((d: any) => `
- ${d.name}: Revenue $${formatNumber(d.revenue).toLocaleString()}, Profit $${formatNumber(d.profit).toLocaleString()}, Miles ${formatNumber(d.miles)}, RPM $${formatNumber(d.rpm).toFixed(2)}, CPM $${formatNumber(d.cpm).toFixed(2)}, Loads ${d.loads || 0}`).join('\n') || 'No driver data available'}`;
    }

    const systemPrompt = `${RIGBY_SYSTEM_PROMPT}

**Current Fleet Data:**
${JSON.stringify(currentMetrics, null, 2)}
${dashboardInfo}

Use this real-time dashboard data to provide specific insights and recommendations. When users ask about performance, profitability, or drivers, reference these exact numbers.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((msg: any) => ({
          role: msg.role,
          content: msg.content
        }))
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    const content = response.choices[0].message.content || '';

    // Extract structured data if present
    let updatedMetrics = null;
    const dataMatch = content.match(/---DATA---([\s\S]*?)---DATA---/);
    if (dataMatch) {
      try {
        const extractedData = JSON.parse(dataMatch[1].trim());
        updatedMetrics = { ...currentMetrics, ...extractedData };
      } catch (e) {
        console.error('Failed to parse extracted data:', e);
      }
    }

    // Remove data block from user-facing message
    const cleanMessage = content.replace(/---DATA---[\s\S]*?---DATA---/g, '').trim();

    return res.json({
      message: cleanMessage,
      updatedMetrics
    });

  } catch (error: any) {
    console.error('Rigby chat error:', error);
    return res.status(500).json({ 
      error: 'Failed to process message',
      details: error.message 
    });
  }
});

export default router;
