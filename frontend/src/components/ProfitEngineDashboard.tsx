import { useState, useEffect } from 'react';
import { Upload, TrendingUp, TrendingDown, DollarSign, Truck, AlertTriangle, Download, Calendar, Settings, Edit2, Trash2, Receipt } from 'lucide-react';
import { API_URL, apiEndpoints } from '../config';


interface Load {
  id: string;
  loadNumber: string;
  grossAmount: number;
  netAmount: number;
  lumper: number;
  deadhead: number;
  miles: number;
  totalMiles: number;
  ratePerMile: number;
  pickupLocation: string;
  dropoffLocation: string;
  pickupDate: string;
  deliveryDate: string;
}

interface DriverMetrics {
  driverName: string;
  grossRevenue: number;
  factoringFee: number;
  netRevenue: number;
  fixedExpenses: number;
  variableExpenses: number;
  drivingExpenses: number;
  totalExpenses: number;
  netProfit: number;
  fixedCPM: number;
  variableCPM: number;
  totalCPM: number;
  rpm: number;
  profitPerMile: number;
  totalMiles: number;
  loads: Load[];
}

interface SummaryMetrics {
  totalRevenue: number;
  totalFactoring: number;
  netRevenue: number;
  totalExpenses: number;
  totalProfit: number;
  profitMargin: number;
  totalMiles: number;
  avgRPM: number;
  avgCPM: number;
  factoringRate: number;
  drivers: DriverMetrics[];
}

interface PeriodOption {
  value: string;
  label: string;
}

const PERIOD_OPTIONS: PeriodOption[] = [
  { value: 'current_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'ytd', label: 'Year to Date' },
  { value: 'last_year', label: 'Last Year' },
  { value: 'custom', label: 'Custom' },
];

export default function ProfitEngineDashboard() {
  const [activeDriver, setActiveDriver] = useState<string>('summary');
  const [summaryData, setSummaryData] = useState<SummaryMetrics | null>(null);
  const [expenseSummary, setExpenseSummary] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('ytd');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [factoringRate, setFactoringRate] = useState(2.2);
  const [showSettings, setShowSettings] = useState(false);
  const [editingLoad, setEditingLoad] = useState<Load | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    if (period === 'custom' && (!customStartDate || !customEndDate)) {
      return;
    }
    fetchDashboardData();
    fetchExpenseSummary();
  }, [period, factoringRate, customStartDate, customEndDate]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const url = apiEndpoints.profitEngine.dashboard(
        period, 
        factoringRate, 
        period === 'custom' ? customStartDate : undefined,
        period === 'custom' ? customEndDate : undefined
      );
      
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        setSummaryData(data.summary);
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchExpenseSummary = async () => {
    try {
      const response = await fetch(`${API_URL}/api/expenses/summary`);
      const data = await response.json();
      if (data.success) {
        setExpenseSummary(data.summary);
      }
    } catch (error) {
      console.error('Error fetching expenses:', error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const formData = new FormData();
    Array.from(files).forEach(file => formData.append('ratecons', file));

    try {
      const response = await fetch(apiEndpoints.profitEngine.uploadRatecons, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        let message = `✅ Processed ${data.processedCount} rate confirmations!`;
        
        if (data.duplicateCount > 0) {
          message += `\n\n⚠️ Warning: ${data.duplicateCount} duplicate load(s) were updated:\n`;
          message += data.duplicates.join(', ');
        }
        
        if (data.newCount > 0) {
          message += `\n\n✅ ${data.newCount} new load(s) added`;
        }
        
        alert(message);
        fetchDashboardData();
      } else {
        alert(`❌ Upload failed: ${data.error}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('❌ Failed to upload rate confirmations');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteLoad = async (loadId: string) => {
    if (!confirm('Are you sure you want to delete this load?')) return;

    try {
      await fetch(apiEndpoints.profitEngine.deleteLoad(loadId), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      
      await fetchDashboardData();
      setActiveDriver('summary');
    } catch (error) {
      await fetchDashboardData();
      setActiveDriver('summary');
    }
  };

  const handleUpdateLoad = async () => {
    if (!editingLoad) return;

    try {
      const response = await fetch(apiEndpoints.profitEngine.updateLoad(editingLoad.id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gross_amount: editingLoad.grossAmount,
          miles: editingLoad.miles,
          pickup_location: editingLoad.pickupLocation,
          dropoff_location: editingLoad.dropoffLocation,
        }),
      });

      const data = await response.json();
      if (data.success) {
        alert('✅ Load updated');
        setShowEditModal(false);
        setEditingLoad(null);
        fetchDashboardData();
      } else {
        alert('❌ Failed to update load');
      }
    } catch (error) {
      console.error('Update error:', error);
      alert('❌ Failed to update load');
    }
  };

  const MetricCard = ({ 
    title, 
    value, 
    subtitle, 
    icon: Icon, 
    trend 
  }: { 
    title: string; 
    value: string; 
    subtitle?: string; 
    icon: any; 
    trend?: 'up' | 'down' | 'neutral';
  }) => (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '20px',
      border: '1px solid #e5e7eb',
      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
        <div style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>{title}</div>
        <div style={{
          width: '32px',
          height: '32px',
          backgroundColor: trend === 'up' ? '#dcfce7' : trend === 'down' ? '#fee2e2' : '#f3f4f6',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Icon size={16} color={trend === 'up' ? '#16a34a' : trend === 'down' ? '#dc2626' : '#6b7280'} />
        </div>
      </div>
      <div style={{ fontSize: '28px', fontWeight: '700', color: '#111827', marginBottom: '4px' }}>
        {value}
      </div>
      {subtitle && (
        <div style={{ fontSize: '12px', color: '#6b7280' }}>
          {subtitle}
        </div>
      )}
    </div>
  );

  const SummaryView = () => {
    if (!summaryData) return null;

    const selectedPeriodLabel = PERIOD_OPTIONS.find(opt => opt.value === period)?.label || 'Custom Period';
    const totalExpensesFromCSV = expenseSummary.reduce((sum, cat) => sum + parseFloat(cat.total_amount || 0), 0);

    return (
      <div>
        {/* Header with Period Filter and Upload */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '32px' }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', marginBottom: '4px' }}>
              Fleet Summary
            </h2>
            <p style={{ fontSize: '14px', color: '#6b7280' }}>
              {selectedPeriodLabel} Performance
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {/* Period Filter Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={16} color="#6b7280" />
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  outline: 'none',
                  minWidth: '160px'
                }}
              >
                {PERIOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Date Range */}
            {period === 'custom' && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: '#374151'
                  }}
                />
                <span style={{ color: '#6b7280' }}>to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: '#374151'
                  }}
                />
              </div>
            )}

            {/* Settings Button */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              style={{
                padding: '8px 12px',
                backgroundColor: showSettings ? '#2563eb' : '#f3f4f6',
                color: showSettings ? 'white' : '#374151',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Settings size={16} />
            </button>

            {/* Upload Button */}
            <input
              type="file"
              id="ratecon-upload"
              multiple
              accept=".pdf"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <label htmlFor="ratecon-upload">
              <button
                type="button"
                onClick={() => document.getElementById('ratecon-upload')?.click()}
                disabled={uploading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
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
                {uploading ? 'Processing...' : 'Upload Rate Cons'}
              </button>
            </label>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '32px',
            border: '1px solid #e5e7eb'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>Dashboard Settings</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label style={{ fontSize: '14px', color: '#374151' }}>
                Factoring Fee Rate:
              </label>
              <input
                type="number"
                value={factoringRate}
                onChange={(e) => setFactoringRate(parseFloat(e.target.value))}
                step="0.1"
                min="0"
                max="10"
                style={{
                  padding: '6px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '14px',
                  width: '80px'
                }}
              />
              <span style={{ fontSize: '14px', color: '#6b7280' }}>%</span>
              <span style={{ fontSize: '13px', color: '#9ca3af', marginLeft: '8px' }}>
                (Set to 0% if you don't use factoring)
              </span>
            </div>
          </div>
        )}

        {/* Key Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '32px' }}>
          <MetricCard
            title="Gross Revenue"
            value={`$${summaryData.totalRevenue.toLocaleString()}`}
            icon={DollarSign}
            trend="neutral"
          />
          <MetricCard
            title="Factoring Fee"
            value={`$${summaryData.totalFactoring.toLocaleString()}`}
            subtitle={`${summaryData.factoringRate.toFixed(1)}% of revenue`}
            icon={TrendingDown}
            trend="neutral"
          />
          <MetricCard
            title="Net Revenue"
            value={`$${summaryData.netRevenue.toLocaleString()}`}
            subtitle="After factoring"
            icon={DollarSign}
            trend="up"
          />
          <MetricCard
            title="Total Expenses"
            value={`$${summaryData.totalExpenses.toLocaleString()}`}
            icon={TrendingDown}
            trend="neutral"
          />
          <MetricCard
            title="Net Profit"
            value={`$${summaryData.totalProfit.toLocaleString()}`}
            subtitle={`${summaryData.profitMargin}% margin`}
            icon={TrendingUp}
            trend={summaryData.totalProfit > 0 ? 'up' : 'down'}
          />
        </div>

        {/* Expense Summary Section */}
        {expenseSummary.length > 0 && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            padding: '24px',
            marginBottom: '32px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Receipt size={20} color="#6b7280" />
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827' }}>
                  Expense Breakdown
                </h3>
              </div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#111827' }}>
                ${totalExpensesFromCSV.toLocaleString()}
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              {expenseSummary.slice(0, 6).map((cat) => (
                <div key={cat.category} style={{
                  padding: '16px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px', textTransform: 'uppercase', fontWeight: '500' }}>
                    {cat.category}
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#111827', marginBottom: '4px' }}>
                    ${parseFloat(cat.total_amount).toLocaleString()}
                  </div>
                  <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                    {cat.transaction_count} transactions
                  </div>
                </div>
              ))}
            </div>
            
            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <a 
                href="#" 
                onClick={(e) => {
                  e.preventDefault();
                  // Navigate to expenses tab - you'll need to implement this
                  window.dispatchEvent(new CustomEvent('navigate-to-expenses'));
                }}
                style={{ fontSize: '13px', color: '#2563eb', textDecoration: 'none', fontWeight: '500' }}
              >
                View all expenses →
              </a>
            </div>
          </div>
        )}

        {/* Per-Driver Breakdown */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827' }}>
              Driver Performance
            </h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '14px' }}>
              <thead style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <tr>
                  <th style={{ padding: '12px 20px', textAlign: 'left', fontWeight: '600', color: '#6b7280' }}>Driver</th>
                  <th style={{ padding: '12px 20px', textAlign: 'right', fontWeight: '600', color: '#6b7280' }}>Gross Revenue</th>
                  <th style={{ padding: '12px 20px', textAlign: 'right', fontWeight: '600', color: '#6b7280' }}>Factoring</th>
                  <th style={{ padding: '12px 20px', textAlign: 'right', fontWeight: '600', color: '#6b7280' }}>Net Revenue</th>
                  <th style={{ padding: '12px 20px', textAlign: 'right', fontWeight: '600', color: '#6b7280' }}>Expenses</th>
                  <th style={{ padding: '12px 20px', textAlign: 'right', fontWeight: '600', color: '#6b7280' }}>Profit</th>
                  <th style={{ padding: '12px 20px', textAlign: 'right', fontWeight: '600', color: '#6b7280' }}>Miles</th>
                  <th style={{ padding: '12px 20px', textAlign: 'right', fontWeight: '600', color: '#6b7280' }}>CPM</th>
                  <th style={{ padding: '12px 20px', textAlign: 'right', fontWeight: '600', color: '#6b7280' }}>RPM</th>
                  <th style={{ padding: '12px 20px', textAlign: 'right', fontWeight: '600', color: '#6b7280' }}>Profit/Mile</th>
                  <th style={{ padding: '12px 20px', textAlign: 'right', fontWeight: '600', color: '#6b7280' }}>Loads</th>
                </tr>
              </thead>
              <tbody>
                {summaryData.drivers.map((driver, idx) => (
                  <tr
                    key={idx}
                    onClick={() => setActiveDriver(driver.driverName.toLowerCase())}
                    style={{
                      borderBottom: '1px solid #f3f4f6',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={{ padding: '16px 20px', fontWeight: '600', color: '#111827' }}>{driver.driverName}</td>
                    <td style={{ padding: '16px 20px', textAlign: 'right', color: '#111827' }}>${driver.grossRevenue.toLocaleString()}</td>
                    <td style={{ padding: '16px 20px', textAlign: 'right', color: '#dc2626' }}>-${driver.factoringFee.toLocaleString()}</td>
                    <td style={{ padding: '16px 20px', textAlign: 'right', color: '#111827' }}>${driver.netRevenue.toLocaleString()}</td>
                    <td style={{ padding: '16px 20px', textAlign: 'right', color: '#111827' }}>${driver.totalExpenses.toLocaleString()}</td>
                    <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: '600', color: driver.netProfit > 0 ? '#16a34a' : '#dc2626' }}>
                      ${driver.netProfit.toLocaleString()}
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right', color: '#111827' }}>{driver.totalMiles.toLocaleString()}</td>
                    <td style={{ padding: '16px 20px', textAlign: 'right', color: '#111827' }}>${driver.totalCPM.toFixed(2)}</td>
                    <td style={{ padding: '16px 20px', textAlign: 'right', color: '#111827' }}>${driver.rpm.toFixed(2)}</td>
                    <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: '600', color: driver.profitPerMile > 0 ? '#16a34a' : '#dc2626' }}>
                      ${driver.profitPerMile.toFixed(2)}
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right', color: '#111827' }}>{driver.loads.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const DriverView = ({ driver }: { driver: DriverMetrics }) => (
    <div>
      {/* Driver Header */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', marginBottom: '4px' }}>
          {driver.driverName}
        </h2>
        <p style={{ fontSize: '14px', color: '#6b7280' }}>
          {driver.loads.length} loads · {driver.totalMiles.toLocaleString()} miles
        </p>
      </div>

      {/* Driver Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
        <MetricCard
          title="Net Profit"
          value={`$${driver.netProfit.toLocaleString()}`}
          icon={DollarSign}
          trend={driver.netProfit > 0 ? 'up' : 'down'}
        />
        <MetricCard
          title="Profit Per Mile"
          value={`$${driver.profitPerMile.toFixed(2)}`}
          icon={TrendingUp}
          trend={driver.profitPerMile > 0 ? 'up' : 'down'}
        />
        <MetricCard
          title="Cost Per Mile"
          value={`$${driver.totalCPM.toFixed(2)}`}
          subtitle={`Fixed: $${driver.fixedCPM.toFixed(2)}`}
          icon={TrendingDown}
          trend="neutral"
        />
        <MetricCard
          title="Rate Per Mile"
          value={`$${driver.rpm.toFixed(2)}`}
          icon={Truck}
          trend="neutral"
        />
      </div>

      {/* Threshold Alerts */}
      {(driver.totalCPM > 1.80 || driver.profitPerMile < 0.50) && (
        <div style={{
          backgroundColor: '#fef3c7',
          border: '1px solid #fbbf24',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '32px',
          display: 'flex',
          alignItems: 'start',
          gap: '12px'
        }}>
          <AlertTriangle size={20} color="#d97706" />
          <div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#92400e', marginBottom: '4px' }}>
              ⚠️ Performance Alert
            </div>
            <div style={{ fontSize: '13px', color: '#78350f' }}>
              {driver.totalCPM > 1.80 && <div>• CPM exceeds target ($1.80)</div>}
              {driver.profitPerMile < 0.50 && <div>• Profit below threshold ($0.50/mi)</div>}
            </div>
          </div>
        </div>
      )}

      {/* Loads Table */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        border: '1px solid #e5e7eb',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827' }}>
            Load History
          </h3>
          <button style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            backgroundColor: '#f3f4f6',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: '500',
            color: '#374151',
            cursor: 'pointer'
          }}>
            <Download size={14} />
            Export
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: '13px' }}>
            <thead style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              <tr>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '600', color: '#6b7280' }}>Load #</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '600', color: '#6b7280' }}>Route</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '600', color: '#6b7280' }}>Gross</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '600', color: '#6b7280' }}>Net</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '600', color: '#6b7280' }}>Miles</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '600', color: '#6b7280' }}>Deadhead</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '600', color: '#6b7280' }}>Total Mi</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '600', color: '#6b7280' }}>RPM</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: '600', color: '#6b7280' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {driver.loads.map((load, idx) => (
                <tr
                  key={idx}
                  style={{ borderBottom: '1px solid #f3f4f6' }}
                >
                  <td style={{ padding: '12px 16px', fontWeight: '500', color: '#111827' }}>{load.loadNumber}</td>
                  <td style={{ padding: '12px 16px', color: '#6b7280' }}>
                    <div style={{ fontSize: '12px' }}>
                      <div>{load.pickupLocation || 'N/A'}</div>
                      <div style={{ color: '#9ca3af' }}>→ {load.dropoffLocation || 'N/A'}</div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: '#111827' }}>${load.grossAmount.toLocaleString()}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: '#111827' }}>${load.netAmount.toLocaleString()}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: '#111827' }}>{load.miles}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: load.deadhead > 100 ? '#dc2626' : '#6b7280' }}>
                    {load.deadhead || 0}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: '#111827' }}>{load.totalMiles}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', color: load.ratePerMile > 2.5 ? '#16a34a' : '#111827' }}>
                    ${load.ratePerMile.toFixed(2)}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button
                        onClick={() => {
                          setEditingLoad(load);
                          setShowEditModal(true);
                        }}
                        style={{
                          padding: '6px',
                          backgroundColor: '#f3f4f6',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title="Edit load"
                      >
                        <Edit2 size={14} color="#374151" />
                      </button>
                      <button
                        onClick={() => handleDeleteLoad(load.id)}
                        style={{
                          padding: '6px',
                          backgroundColor: '#fee2e2',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title="Delete load"
                      >
                        <Trash2 size={14} color="#dc2626" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // Edit Load Modal
  const EditLoadModal = () => {
    if (!showEditModal || !editingLoad) return null;

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          width: '500px',
          maxWidth: '90vw'
        }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '20px' }}>
            Edit Load #{editingLoad.loadNumber}
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '6px', color: '#374151' }}>
                Gross Amount ($)
              </label>
              <input
                type="number"
                value={editingLoad.grossAmount}
                onChange={(e) => setEditingLoad({ ...editingLoad, grossAmount: parseFloat(e.target.value) })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '6px', color: '#374151' }}>
                Miles
              </label>
              <input
                type="number"
                value={editingLoad.miles}
                onChange={(e) => setEditingLoad({ ...editingLoad, miles: parseInt(e.target.value) })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '6px', color: '#374151' }}>
                Pickup Location
              </label>
              <input
                type="text"
                value={editingLoad.pickupLocation}
                onChange={(e) => setEditingLoad({ ...editingLoad, pickupLocation: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '6px', color: '#374151' }}>
                Dropoff Location
              </label>
              <input
                type="text"
                value={editingLoad.dropoffLocation}
                onChange={(e) => setEditingLoad({ ...editingLoad, dropoffLocation: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
            <button
              onClick={() => {
                setShowEditModal(false);
                setEditingLoad(null);
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: '#f3f4f6',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleUpdateLoad}
              style={{
                padding: '8px 16px',
                backgroundColor: '#2563eb',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#6b7280' }}>
        Loading dashboard...
      </div>
    );
  }

  const activeDriverData = summaryData?.drivers.find(d => d.driverName.toLowerCase() === activeDriver);

  return (
    <div style={{ padding: '48px 64px' }}>
      {/* Edit Load Modal */}
      <EditLoadModal />
      
      {/* Driver Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', borderBottom: '2px solid #e5e7eb' }}>
        <button
          onClick={() => setActiveDriver('summary')}
          style={{
            padding: '12px 20px',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: activeDriver === 'summary' ? '2px solid #2563eb' : '2px solid transparent',
            color: activeDriver === 'summary' ? '#2563eb' : '#6b7280',
            fontWeight: activeDriver === 'summary' ? '600' : '500',
            fontSize: '14px',
            cursor: 'pointer',
            marginBottom: '-2px'
          }}
        >
          Summary
        </button>
        {summaryData?.drivers.map((driver) => (
          <button
            key={driver.driverName}
            onClick={() => setActiveDriver(driver.driverName.toLowerCase())}
            style={{
              padding: '12px 20px',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeDriver === driver.driverName.toLowerCase() ? '2px solid #2563eb' : '2px solid transparent',
              color: activeDriver === driver.driverName.toLowerCase() ? '#2563eb' : '#6b7280',
              fontWeight: activeDriver === driver.driverName.toLowerCase() ? '600' : '500',
              fontSize: '14px',
              cursor: 'pointer',
              marginBottom: '-2px'
            }}
          >
            {driver.driverName}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeDriver === 'summary' ? <SummaryView /> : activeDriverData && <DriverView driver={activeDriverData} />}
    </div>
  );
}