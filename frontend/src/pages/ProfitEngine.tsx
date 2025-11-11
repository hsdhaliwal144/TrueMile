// ============================================================================
// PROFIT ENGINE - FRONTEND COMPONENT
// ============================================================================
// Import expenses → Auto-categorize → Calculate profit
// File: src/pages/ProfitEngine.tsx
// ============================================================================

import { useState, useEffect } from 'react';
import { Upload, DollarSign, TrendingUp, TrendingDown, Download, FileText, PieChart } from 'lucide-react';
import { API_URL } from '../config';

interface ExpenseSummary {
  category: string;
  transaction_count: number;
  total_amount: number;
  avg_amount: number;
}

interface ProfitDashboard {
  totalLoads: number;
  totalRevenue: number;
  totalExpenses: number;
  totalDriverPay: number;
  totalProfit: number;
  avgProfitMargin: number;
  avgProfitPerMile: number;
}

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  total: number;
  summary: {
    totalAmount: number;
    byCategory: Record<string, { count: number; amount: number }>;
  };
}

export default function ProfitEngine() {
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [expenseSummary, setExpenseSummary] = useState<ExpenseSummary[]>([]);
  const [profitDashboard, setProfitDashboard] = useState<ProfitDashboard | null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(1)).toISOString().split('T')[0], // First day of month
    endDate: new Date().toISOString().split('T')[0]
  });

  // Load data on mount and when date range changes
  useEffect(() => {
    fetchExpenseSummary();
    fetchProfitDashboard();
  }, [dateRange]);

  // Handle CSV upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_URL}/api/expenses/import`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setImportResult(data);
        // Refresh summaries
        fetchExpenseSummary();
        fetchProfitDashboard();
        alert(`✅ Import successful!\n${data.imported} expenses imported\n${data.skipped} duplicates skipped`);
      } else {
        alert(`❌ Import failed: ${data.error}`);
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(`❌ Failed to upload: ${error.message}`);
    } finally {
      setUploading(false);
      e.target.value = ''; // Reset file input
    }
  };

  // Fetch expense summary
  const fetchExpenseSummary = async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/expenses/summary?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
      );
      const data = await response.json();
      if (data.success) {
        setExpenseSummary(data.summary);
      }
    } catch (error) {
      console.error('Fetch expense summary error:', error);
    }
  };

  // Fetch profit dashboard
  const fetchProfitDashboard = async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/profit/dashboard?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
      );
      const data = await response.json();
      if (data.success) {
        setProfitDashboard(data.dashboard);
      }
    } catch (error) {
      console.error('Fetch profit dashboard error:', error);
    }
  };

  // Category colors
  const categoryColors: Record<string, string> = {
    fuel: '#ef4444',
    tolls: '#f59e0b',
    food: '#10b981',
    maintenance: '#3b82f6',
    software: '#8b5cf6',
    fees: '#ec4899',
    supplies: '#6366f1',
    other: '#6b7280'
  };

  // Category icons
  const categoryIcons: Record<string, string> = {
    fuel: '⛽',
    tolls: '🛣️',
    food: '🍔',
    maintenance: '🔧',
    software: '💻',
    fees: '📋',
    supplies: '📦',
    other: '📌'
  };

  return (
    <div style={{ padding: '48px 64px' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
          Profit Engine
        </h1>
        <p style={{ fontSize: '14px', color: '#6b7280' }}>
          Import credit card statements to calculate true profit per load
        </p>
      </div>

      {/* Date Range Selector */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        border: '1px solid #e5e7eb',
        padding: '20px',
        marginBottom: '24px',
        display: 'flex',
        gap: '16px',
        alignItems: 'center'
      }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#6b7280', marginBottom: '4px' }}>
            Start Date
          </label>
          <input
            type="date"
            value={dateRange.startDate}
            onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
            style={{
              padding: '8px 12px',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#6b7280', marginBottom: '4px' }}>
            End Date
          </label>
          <input
            type="date"
            value={dateRange.endDate}
            onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
            style={{
              padding: '8px 12px',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
        </div>
      </div>

      {/* Upload Section */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        border: '2px dashed #e5e7eb',
        padding: '48px',
        marginBottom: '32px',
        textAlign: 'center'
      }}>
        <FileText size={48} color="#9ca3af" style={{ margin: '0 auto 16px' }} />
        <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>
          Import Credit Card Statement
        </h3>
        <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '24px' }}>
          Upload CSV from American Express, Chase, or any credit card (autopay payments will be filtered out automatically)
        </p>

        <input
          type="file"
          id="csv-upload"
          accept=".csv"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />

        <button
          onClick={() => document.getElementById('csv-upload')?.click()}
          disabled={uploading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            backgroundColor: uploading ? '#9ca3af' : '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: uploading ? 'not-allowed' : 'pointer'
          }}
        >
          <Upload size={16} />
          {uploading ? 'Processing...' : 'Upload CSV'}
        </button>
      </div>

      {/* Import Result */}
      {importResult && (
        <div style={{
          backgroundColor: '#dcfce7',
          border: '1px solid #86efac',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '32px'
        }}>
          <div style={{ fontSize: '16px', fontWeight: '600', color: '#166534', marginBottom: '12px' }}>
            ✅ Import Successful
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#166534', marginBottom: '4px' }}>Imported</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#166534' }}>{importResult.imported}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#166534', marginBottom: '4px' }}>Skipped (Duplicates)</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#166534' }}>{importResult.skipped}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#166534', marginBottom: '4px' }}>Total Amount</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#166534' }}>
                ${importResult.summary.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
          <button
            onClick={() => setImportResult(null)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#166534',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Profit Dashboard */}
      {profitDashboard && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
          padding: '24px',
          marginBottom: '32px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <DollarSign size={24} color="#2563eb" />
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827' }}>
              Profit Overview
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
            <div style={{ backgroundColor: '#f9fafb', borderRadius: '8px', padding: '16px' }}>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Total Revenue</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#111827' }}>
                ${profitDashboard.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                {profitDashboard.totalLoads} loads
              </div>
            </div>

            <div style={{ backgroundColor: '#fef3c7', borderRadius: '8px', padding: '16px' }}>
              <div style={{ fontSize: '12px', color: '#92400e', marginBottom: '4px' }}>Total Expenses</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#92400e' }}>
                ${profitDashboard.totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '11px', color: '#92400e', marginTop: '4px' }}>
                Including driver pay: ${profitDashboard.totalDriverPay.toLocaleString()}
              </div>
            </div>

            <div style={{ backgroundColor: profitDashboard.totalProfit >= 0 ? '#dcfce7' : '#fee2e2', borderRadius: '8px', padding: '16px' }}>
              <div style={{ fontSize: '12px', color: profitDashboard.totalProfit >= 0 ? '#166534' : '#991b1b', marginBottom: '4px' }}>
                Net Profit
              </div>
              <div style={{ 
                fontSize: '24px', 
                fontWeight: '700', 
                color: profitDashboard.totalProfit >= 0 ? '#166534' : '#991b1b',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                {profitDashboard.totalProfit >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                ${Math.abs(profitDashboard.totalProfit).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ 
                fontSize: '11px', 
                color: profitDashboard.totalProfit >= 0 ? '#166534' : '#991b1b', 
                marginTop: '4px' 
              }}>
                {profitDashboard.avgProfitMargin.toFixed(1)}% margin
              </div>
            </div>

            <div style={{ backgroundColor: '#eff6ff', borderRadius: '8px', padding: '16px' }}>
              <div style={{ fontSize: '12px', color: '#1e40af', marginBottom: '4px' }}>Profit Per Mile</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#1e40af' }}>
                ${profitDashboard.avgProfitPerMile.toFixed(2)}
              </div>
              <div style={{ fontSize: '11px', color: '#1e40af', marginTop: '4px' }}>
                Average across all loads
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expense Summary by Category */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        border: '1px solid #e5e7eb',
        overflow: 'hidden',
        marginBottom: '32px'
      }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <PieChart size={20} color="#2563eb" />
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827' }}>
            Expense Breakdown
          </h3>
        </div>

        {expenseSummary.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>
            No expenses imported yet. Upload a CSV to get started!
          </div>
        ) : (
          <div style={{ padding: '20px' }}>
            {expenseSummary.map((category) => (
              <div 
                key={category.category}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px',
                  marginBottom: '8px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '8px',
                  borderLeft: `4px solid ${categoryColors[category.category] || '#6b7280'}`
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '24px' }}>
                    {categoryIcons[category.category] || '📌'}
                  </span>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827', textTransform: 'capitalize' }}>
                      {category.category}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      {category.transaction_count} transactions • Avg ${category.avg_amount.toFixed(2)}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: '#111827' }}>
                  ${category.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div style={{
        backgroundColor: '#eff6ff',
        border: '1px solid #bfdbfe',
        borderRadius: '12px',
        padding: '20px'
      }}>
        <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e40af', marginBottom: '12px' }}>
          💡 How it works
        </div>
        <ol style={{ margin: 0, paddingLeft: '20px', color: '#1e40af', fontSize: '13px', lineHeight: '1.6' }}>
          <li>Export your credit card statement as CSV (Date, Description, Amount columns required)</li>
          <li>Upload the CSV - the system will automatically categorize expenses</li>
          <li>Payments and refunds (negative amounts) are filtered out automatically</li>
          <li>Expenses are matched to drivers by card member name</li>
          <li>Link expenses to loads to calculate true profit per load</li>
        </ol>
      </div>
    </div>
  );
}