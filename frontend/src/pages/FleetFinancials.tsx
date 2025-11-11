import { useState, useEffect } from 'react';
import { Upload, Trash2, X, Edit2 } from 'lucide-react';
import { API_URL } from '../config';

interface Load {
  id: number;
  loadNumber: string;
  grossAmount: number;
  netAmount: number;
  miles: number;
  ratePerMile: number;
  pickupLocation: string;
  dropoffLocation: string;
  pickupDate: string;
}

interface DriverData {
  driverName: string;
  grossRevenue: number;
  netRevenue: number;
  fixedExpenses: number;
  variableExpenses: number;
  totalExpenses: number;
  netProfit: number;
  totalMiles: number;
  rpm: number;
  totalCPM: number;
  fixedCPM: number;
  variableCPM: number;
  loads: Load[];
  payRate?: number;
  driverPay?: number;
}

interface DashboardSummary {
  totalRevenue: number;
  netRevenue: number;
  totalExpenses: number;
  totalProfit: number;
  totalMiles: number;
  avgRPM: number;
  avgCPM: number;
  profitMargin: string;
  factoringRate: number;
  drivers: DriverData[];
}

interface Driver {
  id: number;
  name: string;
  active: boolean;
}

interface Batch {
  id: number;
  batch_type: string;
  upload_date: string;
  file_count: number;
  record_count: number;
  current_record_count: number;
  description: string;
  metadata: any;
}

interface UnknownDriver {
  name: string;
  sampleLoads: Array<{ loadNumber: string; amount: number; location: string }>;
}

export default function FleetFinancials() {
  const [period, setPeriod] = useState('ytd');
  const [factoringRate, setFactoringRate] = useState('2.2');
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [expenseData, setExpenseData] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState<'ratecons' | 'expenses' | null>(null);
  const [showExpenseModal, setShowExpenseModal] = useState<'combined' | null>(null);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showAliasModal, setShowAliasModal] = useState(false);
  const [selectedDriverForAlias, setSelectedDriverForAlias] = useState<string | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('summary');
  const [expandedDriver, setExpandedDriver] = useState<string | null>(null);
  const [showDriverAssignmentModal, setShowDriverAssignmentModal] = useState(false);
  const [unassignedLoads, setUnassignedLoads] = useState<any[]>([]);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [selectedLoad, setSelectedLoad] = useState<Load | null>(null);
  const [reassignDriverId, setReassignDriverId] = useState<number | null>(null);
  const [editingPayRate, setEditingPayRate] = useState<{driver: string, rate: string} | null>(null);

  useEffect(() => {
    fetchDashboard();
    fetchDrivers();
    fetchExpensesByDriver();
  }, [period, factoringRate]);

  const fetchDashboard = async () => {
  setLoading(true);
  try {
    const rate = factoringRate || '0';
    const response = await fetch(`${API_URL}/api/profit-engine/dashboard?period=${period}&factoringRate=${rate}`);
    const data = await response.json();
    if (data.success) {
      // Calculate driverPay from payRate if not already calculated
      const summaryWithDriverPay = {
        ...data.summary,
        drivers: data.summary.drivers.map((d: DriverData) => ({
          ...d,
          driverPay: (d.payRate || 0) * d.totalMiles
        }))
      };
      setSummary(summaryWithDriverPay);
    }
  } catch (error) {
    console.error('Dashboard fetch error:', error);
  } finally {
    setLoading(false);
  }
};

  const fetchExpensesByDriver = async () => {
    try {
      const response = await fetch(`${API_URL}/api/profit-engine/expenses-by-driver?period=${period}`);
      const data = await response.json();
      if (data.success) {
        setExpenseData(data.expensesByDriver);
      }
    } catch (error) {
      console.error('Fetch expenses error:', error);
    }
  };

  const fetchDrivers = async () => {
    try {
      const response = await fetch(`${API_URL}/api/profit-engine/drivers`);
      const data = await response.json();
      if (data.success) {
        setDrivers(data.drivers);
      }
    } catch (error) {
      console.error('Drivers fetch error:', error);
    }
  };

  const formatCurrency = (amount: number, showParens = false) => {
    const absAmount = Math.abs(amount);
    const formatted = `$${absAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (showParens && amount < 0) {
      return `(${formatted})`;
    }
    return formatted;
  };

  const getProfitColor = (amount: number) => {
    return amount >= 0 ? '#16a34a' : '#dc2626';
  };

  const handleAddAlias = async (driverName: string, alias: string) => {
    try {
      const response = await fetch(`${API_URL}/api/profit-engine/drivers/alias`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverName, alias })
      });
      const data = await response.json();
      if (data.success) {
        alert('✅ Alias added successfully');
        await fetchDashboard();
      }
    } catch (error) {
      console.error('Add alias error:', error);
    }
  };

  const handleDeleteLoad = async (loadId: number) => {
    if (!confirm('Delete this load?')) return;
    
    try {
      const response = await fetch(`${API_URL}/api/profit-engine/loads/${loadId}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (data.success) {
        await fetchDashboard();
        
        const updatedSummary = await fetch(`${API_URL}/api/profit-engine/dashboard?period=${period}&factoringRate=${factoringRate || '0'}`);
        const updatedData = await updatedSummary.json();
        
        if (updatedData.success) {
          const currentDriverData = updatedData.summary.drivers.find((d: any) => d.driverName === activeTab);
          if (currentDriverData && currentDriverData.loads.length === 0 && currentDriverData.grossRevenue === 0) {
            setActiveTab('summary');
          }
        }
      }
    } catch (error) {
      console.error('Delete load error:', error);
    }
  };

  const handleReassignLoad = async () => {
    if (!selectedLoad || !reassignDriverId) return;

    try {
      const response = await fetch(`${API_URL}/api/profit-engine/loads/${selectedLoad.id}/reassign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId: reassignDriverId })
      });

      const data = await response.json();
      if (data.success) {
        alert('✅ Load reassigned successfully');
        setShowReassignModal(false);
        setSelectedLoad(null);
        setReassignDriverId(null);
        await fetchDashboard();
      }
    } catch (error) {
      console.error('Reassign error:', error);
      alert('❌ Failed to reassign load');
    }
  };

  const handleUpdatePayRate = async (driverName: string, payRate: number) => {
  try {
    const driver = drivers.find(d => d.name === driverName);
    if (!driver) return;

    // Save to backend first
    await fetch(`${API_URL}/api/profit-engine/drivers/${driver.id}/pay-rate`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payRate })
    });

    // Refresh dashboard to get recalculated totals
    await fetchDashboard();
  } catch (error) {
    console.error('Update pay rate error:', error);
  }
};

  const fixedCategories = ['Insurance', 'Truck Payment', 'Trailer Payment', 'G/A', 'Logbook (ELD)', 'Pre-Pass', 'Load Board', 'IFTA', 'Compliance', 'Payroll Tax', 'Business Tax', 'Interest Payments'];
  const variableCategories = ['Repair & Maintenance', 'Fuel', 'Misc', 'Food', 'Lumper', 'Factoring Fee', 'Toll', 'Scales'];

  const getExpenseAmount = (driverName: string, category: string) => {
    const categoryMap: Record<string, string> = {
      'Repair & Maintenance': 'repair',
      'Fuel': 'fuel',
      'Misc': 'misc',
      'Food': 'food',
      'Lumper': 'lumper',
      'Toll': 'toll',
      'Scales': 'scales',
      'Logbook (ELD)': 'eld',
      'Pre-Pass': 'prepass',
      'Load Board': 'load_board',
      'IFTA': 'ifta',
      'Compliance': 'compliance',
      'Insurance': 'insurance',
      'Truck Payment': 'truck_payment',
      'Trailer Payment': 'trailer_payment',
      'G/A': 'cpa',
      'Payroll Tax': 'payroll_tax',
      'Business Tax': 'business_tax',
      'Interest Payments': 'interest_payments'
    };
    
    if (category === 'Repair & Maintenance') {
      const repair = expenseData[driverName]?.['repair'] || 0;
      const maintenance = expenseData[driverName]?.['maintenance'] || 0;
      return repair + maintenance;
    }
    
    const expenseType = categoryMap[category];
    return expenseData[driverName]?.[expenseType] || 0;
  };

  const getDriverFixedExpenses = (driverName: string) => {
    return fixedCategories.reduce((sum, cat) => sum + getExpenseAmount(driverName, cat), 0);
  };

  const getDriverVariableExpenses = (driverName: string) => {
    return variableCategories.filter(c => c !== 'Factoring Fee').reduce((sum, cat) => sum + getExpenseAmount(driverName, cat), 0);
  };

  const updateExpenseAmount = async (driverName: string, category: string, newValue: number) => {
    const categoryMap: Record<string, string> = {
      'Repair & Maintenance': 'repair',
      'Fuel': 'fuel',
      'Misc': 'misc',
      'Food': 'food',
      'Lumper': 'lumper',
      'Toll': 'toll',
      'Scales': 'scales',
      'Logbook (ELD)': 'eld',
      'Pre-Pass': 'prepass',
      'Load Board': 'load_board',
      'IFTA': 'ifta',
      'Compliance': 'compliance',
      'Insurance': 'insurance',
      'Truck Payment': 'truck_payment',
      'Trailer Payment': 'trailer_payment',
      'G/A': 'cpa',
      'Payroll Tax': 'payroll_tax',
      'Business Tax': 'business_tax',
      'Interest Payments': 'interest_payments'
    };
    
    const expenseType = categoryMap[category];
    if (!expenseType) return;

    setExpenseData(prev => ({
      ...prev,
      [driverName]: {
        ...prev[driverName],
        [expenseType]: newValue
      }
    }));

    try {
      const driver = drivers.find(d => d.name === driverName);
      if (!driver) return;

      await fetch(`${API_URL}/api/profit-engine/expenses/${driver.id}/${expenseType}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: newValue })
      });
    } catch (error) {
      console.error('Save expense error:', error);
    }
  };

  const currentDriver = activeTab !== 'summary' ? summary?.drivers.find(d => d.driverName === activeTab) : null;
  const factoringFee = summary ? summary.totalRevenue * (summary.factoringRate / 100) : 0;
  const fixedExpenses = summary ? summary.drivers.reduce((sum, d) => sum + getDriverFixedExpenses(d.driverName), 0) : 0;
  const variableExpenses = summary ? summary.drivers.reduce((sum, d) => {
  const driverFactoring = d.grossRevenue * (summary.factoringRate / 100);
  return sum + getDriverVariableExpenses(d.driverName) + driverFactoring + (d.driverPay || 0);
}, 0) : 0;
  const totalExpensesWithFactoring = fixedExpenses + variableExpenses;

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280' }}>
        Loading dashboard...
      </div>
    );
  }

  const ExpenseModal = ({ type, onClose }: { type: 'combined', onClose: () => void }) => {
    const [editingCell, setEditingCell] = useState<{driver: string, category: string} | null>(null);
    const [editValue, setEditValue] = useState('');

    const handleCellClick = (driver: string, category: string) => {
      const amount = getExpenseAmount(driver, category);
      setEditingCell({ driver, category });
      setEditValue(amount.toString());
    };

    const handleCellBlur = () => {
      if (editingCell) {
        const newValue = parseFloat(editValue) || 0;
        updateExpenseAmount(editingCell.driver, editingCell.category, newValue);
        setEditingCell(null);
      }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleCellBlur();
      }
    };

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
      }} onClick={onClose}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '28px',
          width: '700px',
          maxWidth: '90vw',
          maxHeight: '80vh',
          overflow: 'auto'
        }} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700' }}>
              Expense Breakdown
            </h3>
            <button onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#6b7280' }}>
              ×
            </button>
          </div>

          <div style={{ marginBottom: '28px' }}>
            <h4 style={{ fontSize: '15px', fontWeight: '700', color: '#111827', marginBottom: '12px' }}>
              Fixed Expenses
            </h4>
            <div style={{ fontSize: '13px' }}>
              {summary?.drivers.map((driver, idx) => {
                const driverFixedTotal = getDriverFixedExpenses(driver.driverName);
                
                return (
                  <div key={idx} style={{ marginBottom: '8px' }}>
                    <div 
                      onClick={() => setExpandedDriver(expandedDriver === `fixed-${driver.driverName}` ? null : `fixed-${driver.driverName}`)}
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        padding: '12px',
                        backgroundColor: '#fafafa',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        border: '1px solid #e5e7eb'
                      }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#6b7280', fontSize: '12px' }}>
                          {expandedDriver === `fixed-${driver.driverName}` ? '▼' : '▸'}
                        </span>
                        <span style={{ color: '#111827', fontWeight: '600' }}>{driver.driverName}</span>
                      </div>
                      <span style={{ fontWeight: '600', color: '#111827' }}>
                        ${driverFixedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    {expandedDriver === `fixed-${driver.driverName}` && (
                      <div style={{ paddingLeft: '24px', paddingTop: '8px', backgroundColor: '#f9fafb', borderRadius: '0 0 6px 6px', padding: '12px 12px 12px 32px' }}>
                        {fixedCategories.map((category, catIdx) => {
                          const amount = getExpenseAmount(driver.driverName, category);
                          const isEditing = editingCell?.driver === driver.driverName && editingCell?.category === category;
                          
                          return (
                            <div key={catIdx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: catIdx < fixedCategories.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                              <span style={{ color: '#6b7280', fontSize: '12px' }}>{category}</span>
                              {isEditing ? (
                                <input
                                  type="number"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={handleCellBlur}
                                  onKeyPress={handleKeyPress}
                                  autoFocus
                                  style={{
                                    width: '100px',
                                    padding: '2px 6px',
                                    border: '1px solid #2563eb',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    textAlign: 'right'
                                  }}
                                />
                              ) : (
                                <span 
                                  onClick={() => handleCellClick(driver.driverName, category)}
                                  style={{ 
                                    color: '#374151', 
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    transition: 'background-color 0.15s'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                  ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              <div style={{ borderTop: '2px solid #e5e7eb', marginTop: '12px', paddingTop: '12px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: '700', color: '#111827' }}>Total Fixed</span>
                <span style={{ fontWeight: '700', color: '#111827', fontSize: '16px' }}>
                  ${summary?.drivers.reduce((sum, driver) => sum + getDriverFixedExpenses(driver.driverName), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: '15px', fontWeight: '700', color: '#111827', marginBottom: '12px' }}>
              Variable Expenses
            </h4>
            <div style={{ fontSize: '13px' }}>
              {summary?.drivers.map((driver, idx) => {
                const driverFactoringFee = driver.grossRevenue * (summary.factoringRate / 100);
                const driverVariable = getDriverVariableExpenses(driver.driverName);
                const driverVariableTotal = driverFactoringFee + driverVariable + (driver.driverPay || 0);
                
                return (
                  <div key={idx} style={{ marginBottom: '8px' }}>
                    <div 
                      onClick={() => setExpandedDriver(expandedDriver === `variable-${driver.driverName}` ? null : `variable-${driver.driverName}`)}
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        padding: '12px',
                        backgroundColor: '#fafafa',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        border: '1px solid #e5e7eb'
                      }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#6b7280', fontSize: '12px' }}>
                          {expandedDriver === `variable-${driver.driverName}` ? '▼' : '▸'}
                        </span>
                        <span style={{ color: '#111827', fontWeight: '600' }}>{driver.driverName}</span>
                      </div>
                      <span style={{ fontWeight: '600', color: '#111827' }}>
                        ${driverVariableTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    {expandedDriver === `variable-${driver.driverName}` && (
                      <div style={{ paddingLeft: '24px', paddingTop: '8px', backgroundColor: '#f9fafb', borderRadius: '0 0 6px 6px', padding: '12px 12px 12px 32px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e5e7eb' }}>
                          <span style={{ color: '#6b7280', fontSize: '12px', fontWeight: '600' }}>Factoring Fee</span>
                          <span style={{ color: '#374151', fontSize: '12px', fontWeight: '600' }}>
                            ${driverFactoringFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e5e7eb' }}>
                          <span style={{ color: '#6b7280', fontSize: '12px', fontWeight: '600' }}>Driver Pay</span>
                          <span style={{ color: '#374151', fontSize: '12px', fontWeight: '600' }}>
                            ${(driver.driverPay || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        {variableCategories.filter(c => c !== 'Factoring Fee').map((category, catIdx) => {
                          const amount = getExpenseAmount(driver.driverName, category);
                          const isEditing = editingCell?.driver === driver.driverName && editingCell?.category === category;
                          
                          return (
                            <div key={catIdx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: catIdx < variableCategories.length - 2 ? '1px solid #e5e7eb' : 'none' }}>
                              <span style={{ color: '#6b7280', fontSize: '12px' }}>{category}</span>
                              {isEditing ? (
                                <input
                                  type="number"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={handleCellBlur}
                                  onKeyPress={handleKeyPress}
                                  autoFocus
                                  style={{
                                    width: '100px',
                                    padding: '2px 6px',
                                    border: '1px solid #2563eb',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    textAlign: 'right'
                                  }}
                                />
                              ) : (
                                <span 
                                  onClick={() => handleCellClick(driver.driverName, category)}
                                  style={{ 
                                    color: '#374151', 
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    transition: 'background-color 0.15s'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                  ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              <div style={{ borderTop: '2px solid #e5e7eb', marginTop: '12px', paddingTop: '12px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: '700', color: '#111827' }}>Total Variable</span>
                <span style={{ fontWeight: '700', color: '#111827', fontSize: '16px' }}>
                  ${summary?.drivers.reduce((sum, driver) => {
                  const driverFactoringFee = driver.grossRevenue * (summary.factoringRate / 100);
                  const driverVariable = getDriverVariableExpenses(driver.driverName);
                  return sum + driverFactoringFee + driverVariable + (driver.driverPay || 0);
                }, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const UploadModal = ({ type, onClose }: { type: 'ratecons' | 'expenses', onClose: () => void }) => (
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
    }} onClick={onClose}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '28px',
        width: '440px',
        maxWidth: '90vw'
      }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px' }}>
          Upload {type === 'ratecons' ? 'Rate Confirmations' : 'Expenses'}
        </h3>

        <input
          type="file"
          id={`file-${type}`}
          accept={type === 'ratecons' ? '.pdf' : '.csv,.xlsx'}
          multiple={type === 'ratecons'}
          onChange={async (e) => {
            const files = e.target.files;
            if (!files || files.length === 0) return;

            setUploading(true);
            const formData = new FormData();
            
            if (type === 'ratecons') {
              Array.from(files).forEach(file => formData.append('files', file));
            } else {
              formData.append('csv', files[0]);
            }

            try {
              const endpoint = type === 'ratecons' ? '/api/profit-engine/upload-ratecon' : '/api/expenses/import';
              const response = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                body: formData
              });

              const data = await response.json();
              if (data.success) {
                if (data.unassignedLoads && data.unassignedLoads.length > 0) {
                  setUnassignedLoads(data.unassignedLoads);
                  setShowDriverAssignmentModal(true);
                  alert(`⚠️ ${data.unassignedLoads.length} load(s) need driver assignment`);
                } else {
                  alert(`✅ Uploaded successfully`);
                }
                await fetchDashboard();
                await fetchExpensesByDriver();
                onClose();
              } else {
                alert(`❌ Upload failed: ${data.error}`);
              }
            } catch (error) {
              console.error('Upload error:', error);
              alert('❌ Upload failed');
            } finally {
              setUploading(false);
            }
          }}
          style={{ display: 'none' }}
        />

        <label
          htmlFor={`file-${type}`}
          style={{
            display: 'block',
            padding: '48px 24px',
            border: '2px dashed #d1d5db',
            borderRadius: '8px',
            textAlign: 'center',
            cursor: uploading ? 'not-allowed' : 'pointer',
            backgroundColor: '#fafafa',
            marginBottom: '16px',
            transition: 'all 0.15s'
          }}
          onMouseEnter={(e) => {
            if (!uploading) {
              e.currentTarget.style.borderColor = '#9ca3af';
              e.currentTarget.style.backgroundColor = '#f3f4f6';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#d1d5db';
            e.currentTarget.style.backgroundColor = '#fafafa';
          }}>
          <Upload size={28} color="#9ca3af" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#111827', marginBottom: '4px' }}>
            {uploading ? 'Uploading...' : 'Click to upload'}
          </div>
          <div style={{ fontSize: '11px', color: '#6b7280' }}>
            {type === 'ratecons' ? 'PDF (multiple allowed)' : 'CSV or Excel'}
          </div>
        </label>

        <button
          onClick={onClose}
          disabled={uploading}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: '#f3f4f6',
            color: '#374151',
            border: 'none',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: uploading ? 'not-allowed' : 'pointer'
          }}>
          Cancel
        </button>
      </div>
    </div>
  );

  const BatchManagerModal = ({ onClose }: { onClose: () => void }) => {
    const [deleting, setDeleting] = useState<number | null>(null);
    const [localBatches, setLocalBatches] = useState<Batch[]>([]);
    
    useEffect(() => {
      const loadBatches = async () => {
        try {
          const response = await fetch(`${API_URL}/api/profit-engine/batches`);
          const data = await response.json();
          if (data.success) {
            setLocalBatches(data.batches);
          }
        } catch (error) {
          console.error('Batches fetch error:', error);
        }
      };
      loadBatches();
    }, []);
    
    const handleDelete = async (batchId: number, batchType: string, recordCount: number) => {
      if (deleting) return;
      if (!confirm(`Delete this ${batchType} batch? This will remove ${recordCount} record(s).`)) return;

      setDeleting(batchId);
      try {
        const response = await fetch(`${API_URL}/api/profit-engine/batches/${batchId}`, {
          method: 'DELETE',
        });

        const data = await response.json();
        if (data.success) {
          alert(`✅ Deleted ${data.deleted.recordCount} ${batchType} records`);
          setLocalBatches(prev => prev.filter(b => b.id !== batchId));
          await fetchDashboard();
          await fetchExpensesByDriver();
        }
      } catch (error: any) {
        console.error('Delete batch error:', error);
        alert(`❌ Delete failed: ${error.message}`);
      } finally {
        setDeleting(null);
      }
    };

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
      }} onClick={onClose}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '28px',
          width: '700px',
          maxWidth: '90vw',
          maxHeight: '80vh',
          overflow: 'auto'
        }} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Upload History</h3>
            <button onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#6b7280' }}>
              ×
            </button>
          </div>

          {localBatches.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
              No upload batches yet
            </div>
          ) : (
            <div>
              {['ratecons', 'expenses', 'fuel_receipts'].map(type => {
                const typeBatches = localBatches.filter(b => b.batch_type === type);
                if (typeBatches.length === 0) return null;

                return (
                  <div key={type} style={{ marginBottom: '24px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#111827', marginBottom: '12px', textTransform: 'uppercase' }}>
                      {type === 'ratecons' ? '📄 Rate Confirmations' : type === 'fuel_receipts' ? '⛽ Fuel Receipts' : '💳 Expenses'}
                    </h4>
                    <table style={{ width: '100%', fontSize: '13px', backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                      <thead style={{ backgroundColor: '#fafafa', borderBottom: '1px solid #e5e7eb' }}>
                        <tr>
                          <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '600', color: '#6b7280' }}>Date</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '600', color: '#6b7280' }}>File</th>
                          <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600', color: '#6b7280' }}>Records</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '600', color: '#6b7280' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {typeBatches.map(batch => {
                          const metadata = batch.metadata;
                          let filename = 'Unknown';
                          if (metadata) {
                            if (metadata.filename) filename = metadata.filename;
                            else if (metadata.files && metadata.files.length > 0) filename = metadata.files[0];
                          }
                          const recordCount = batch.current_record_count || batch.record_count || 0;
                          
                          return (
                            <tr key={batch.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                              <td style={{ padding: '12px', color: '#111827' }}>
                                {new Date(batch.upload_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </td>
                              <td style={{ padding: '12px', color: '#111827', fontSize: '12px' }}>
                                {filename.length > 35 ? filename.substring(0, 35) + '...' : filename}
                              </td>
                              <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: '#111827' }}>
                                {recordCount.toLocaleString()}
                              </td>
                              <td style={{ padding: '12px', textAlign: 'center' }}>
                                <button
                                  onClick={() => handleDelete(batch.id, batch.batch_type, recordCount)}
                                  style={{
                                    padding: '6px 12px',
                                    backgroundColor: '#fee2e2',
                                    color: '#dc2626',
                                    border: 'none',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'background-color 0.15s'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fecaca'}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}>
                                  Delete
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const AliasModal = ({ driverName, onClose }: { driverName: string, onClose: () => void }) => {
    const [alias, setAlias] = useState('');

    const handleSubmit = () => {
      if (!alias.trim()) return;
      handleAddAlias(driverName, alias.trim());
      onClose();
    };

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
          padding: '28px',
          width: '440px',
          maxWidth: '90vw'
        }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>
            Add Alias for {driverName}
          </h3>
          <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '20px' }}>
            Add an alternative name that should map to this driver
          </p>

          <input
            type="text"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="Enter alias name"
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              marginBottom: '16px'
            }}
            onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
          />

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handleSubmit}
              disabled={!alias.trim()}
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: alias.trim() ? '#2563eb' : '#d1d5db',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: alias.trim() ? 'pointer' : 'not-allowed'
              }}>
              Add Alias
            </button>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: '#f3f4f6',
                color: '#374151',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer'
              }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  const DriverAssignmentModal = ({ loads, onClose }: { loads: any[], onClose: () => void }) => {
    const [assignments, setAssignments] = useState<Record<number, { driverId?: number; newDriverName?: string }>>({});

    const handleAssign = async () => {
      try {
        for (const load of loads) {
          const assignment = assignments[load.id];
          if (!assignment) continue;

          await fetch(`${API_URL}/api/profit-engine/loads/${load.id}/assign-driver`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              driverId: assignment.driverId,
              createNewDriver: !!assignment.newDriverName,
              newDriverName: assignment.newDriverName
            })
          });
        }

        alert('✅ Drivers assigned successfully');
        await fetchDashboard();
        await fetchDrivers();
        onClose();
      } catch (error) {
        console.error('Assignment error:', error);
        alert('❌ Failed to assign drivers');
      }
    };

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
      }} onClick={onClose}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '28px',
          width: '600px',
          maxWidth: '90vw',
          maxHeight: '80vh',
          overflow: 'auto'
        }} onClick={(e) => e.stopPropagation()}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px' }}>
            Assign Drivers to Loads
          </h3>

          {loads.map(load => (
            <div key={load.id} style={{
              marginBottom: '20px',
              padding: '16px',
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                  Load #{load.loadNumber}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  {load.pickupLocation} → {load.dropoffLocation} | ${load.grossAmount.toLocaleString()} | {load.miles} mi
                </div>
                {load.suggestedDriverName && (
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                    Suggested: {load.suggestedDriverName}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <select
                  value={assignments[load.id]?.driverId || ''}
                  onChange={(e) => setAssignments({
                    ...assignments,
                    [load.id]: { driverId: e.target.value ? parseInt(e.target.value) : undefined }
                  })}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '13px'
                  }}>
                  <option value="">Select existing driver...</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>

                <div style={{ fontSize: '12px', color: '#6b7280', display: 'flex', alignItems: 'center' }}>OR</div>

                <input
                  type="text"
                  placeholder="New driver name"
                  value={assignments[load.id]?.newDriverName || ''}
                  onChange={(e) => setAssignments({
                    ...assignments,
                    [load.id]: { newDriverName: e.target.value.toUpperCase() }
                  })}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '13px'
                  }}
                />
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button
              onClick={handleAssign}
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer'
              }}>
              Assign Drivers
            </button>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: '#f3f4f6',
                color: '#374151',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer'
              }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  const MetricCard = ({ label, value, subtitle, onClick }: { label: string; value: string | React.ReactNode; subtitle?: string; onClick?: () => void }) => (
    <div 
      onClick={onClick}
      style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        border: '1px solid #e5e7eb',
        padding: '24px',
        cursor: onClick ? 'pointer' : 'default',
        transition: onClick ? 'all 0.15s' : 'none',
        textAlign: 'center'
      }}
      onMouseEnter={(e) => onClick && (e.currentTarget.style.borderColor = '#2563eb')}
      onMouseLeave={(e) => onClick && (e.currentTarget.style.borderColor = '#e5e7eb')}>
      <div style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
        {label}
      </div>
      <div style={{ fontSize: '32px', fontWeight: '700', color: '#111827', marginBottom: '4px' }}>
        {value}
      </div>
      {subtitle && (
        <div style={{ fontSize: '12px', color: '#9ca3af' }}>
          {subtitle}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ padding: '32px 40px', backgroundColor: '#f9fafb', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {showUploadModal && <UploadModal type={showUploadModal} onClose={() => setShowUploadModal(null)} />}
      {showExpenseModal && <ExpenseModal type={showExpenseModal} onClose={() => setShowExpenseModal(null)} />}
      {showBatchModal && <BatchManagerModal onClose={() => setShowBatchModal(false)} />}
      {showAliasModal && selectedDriverForAlias && (
        <AliasModal driverName={selectedDriverForAlias} onClose={() => { setShowAliasModal(false); setSelectedDriverForAlias(null); }} />
      )}

      {showDriverAssignmentModal && unassignedLoads.length > 0 && (
        <DriverAssignmentModal loads={unassignedLoads} onClose={() => { setShowDriverAssignmentModal(false); setUnassignedLoads([]); }} />
      )}

      {showReassignModal && selectedLoad && (
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
        }} onClick={() => setShowReassignModal(false)}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '28px',
            width: '440px',
            maxWidth: '90vw'
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>
              Reassign Load #{selectedLoad.loadNumber}
            </h3>
            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '20px' }}>
              Select a new driver for this load
            </p>

            <select
              value={reassignDriverId || ''}
              onChange={(e) => setReassignDriverId(parseInt(e.target.value))}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                fontSize: '14px',
                marginBottom: '16px'
              }}>
              <option value="">Select driver...</option>
              {drivers.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleReassignLoad}
                disabled={!reassignDriverId}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: reassignDriverId ? '#2563eb' : '#d1d5db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: reassignDriverId ? 'pointer' : 'not-allowed'
                }}>
                Reassign
              </button>
              <button
                onClick={() => {
                  setShowReassignModal(false);
                  setSelectedLoad(null);
                  setReassignDriverId(null);
                }}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', marginBottom: '2px' }}>
              Fleet Financials
            </h1>
            <p style={{ fontSize: '13px', color: '#6b7280' }}>
              Real-time profit tracking and driver performance
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              style={{
                padding: '8px 32px 8px 12px',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '500',
                backgroundColor: 'white',
                color: '#374151',
                cursor: 'pointer',
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 10px center'
              }}>
              <option value="ytd">YTD</option>
              <option value="q4">Q4</option>
              <option value="q3">Q3</option>
              <option value="q2">Q2</option>
              <option value="q1">Q1</option>
            </select>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
              <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>Factoring:</span>
              <input
                type="number"
                step="0.1"
                value={factoringRate}
                onChange={(e) => setFactoringRate(e.target.value)}
                style={{
                  width: '45px',
                  padding: '2px 4px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '4px',
                  fontSize: '13px',
                  fontWeight: '500',
                  textAlign: 'center',
                  backgroundColor: 'white',
                  color: '#374151'
                }}
              />
              <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>%</span>
            </div>

            <button
              onClick={() => setShowUploadModal('ratecons')}
              style={{
                padding: '8px 14px',
                backgroundColor: '#2563eb',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'background-color 0.15s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}>
              <Upload size={14} />
              Rate Cons
            </button>

            <button
              onClick={() => setShowUploadModal('expenses')}
              style={{
                padding: '8px 14px',
                backgroundColor: '#2563eb',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'background-color 0.15s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}>
              <Upload size={14} />
              Expenses
            </button>

            <button
              onClick={() => setShowBatchModal(true)}
              style={{
                padding: '8px 10px',
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '500',
                color: '#6b7280',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#fafafa';
                e.currentTarget.style.borderColor = '#d1d5db';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'white';
                e.currentTarget.style.borderColor = '#e5e7eb';
              }}>
              🗑️ Delete
            </button>
          </div>
        </div>

        {!summary || summary.totalRevenue === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>
              No Data Yet
            </h3>
            <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '20px' }}>
              Upload rate confirmations and expenses to get started
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => setShowUploadModal('ratecons')}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}>
                Upload Rate Cons
              </button>
              <button
                onClick={() => setShowUploadModal('expenses')}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'white',
                  color: '#374151',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}>
                Upload Expenses
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ 
              display: 'flex', 
              gap: '4px', 
              borderBottom: '2px solid #e5e7eb',
              marginBottom: '24px'
            }}>
              <button
                onClick={() => setActiveTab('summary')}
                style={{
                  padding: '10px 16px',
                  backgroundColor: activeTab === 'summary' ? 'white' : 'transparent',
                  color: activeTab === 'summary' ? '#2563eb' : '#6b7280',
                  border: 'none',
                  borderBottom: activeTab === 'summary' ? '2px solid #2563eb' : '2px solid transparent',
                  marginBottom: '-2px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}>
                Summary
              </button>
              {summary.drivers.map((driver) => (
                <div key={driver.driverName} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    onClick={() => setActiveTab(driver.driverName)}
                    style={{
                      padding: '10px 16px',
                      backgroundColor: activeTab === driver.driverName ? 'white' : 'transparent',
                      color: activeTab === driver.driverName ? '#2563eb' : '#6b7280',
                      border: 'none',
                      borderBottom: activeTab === driver.driverName ? '2px solid #2563eb' : '2px solid transparent',
                      marginBottom: '-2px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}>
                    {driver.driverName}
                  </button>
                  <button
                    onClick={() => {
                      setSelectedDriverForAlias(driver.driverName);
                      setShowAliasModal(true);
                    }}
                    style={{
                      padding: '4px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#9ca3af',
                      marginBottom: '-2px'
                    }}
                    title="Add alias">
                    <Edit2 size={12} />
                  </button>
                </div>
              ))}
            </div>

            {activeTab === 'summary' ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
                  <MetricCard
                    label="Gross Revenue"
                    value={formatCurrency(summary.totalRevenue)}
                  />
                  <MetricCard
                    label="Total Expenses"
                    value={
                      <span style={{ color: '#dc2626' }}>
                        {formatCurrency(totalExpensesWithFactoring, true)}
                      </span>
                    }
                    subtitle="Fixed + Variable"
                    onClick={() => setShowExpenseModal('combined')}
                  />
                  <MetricCard
                    label="Net Profit"
                    value={
                      <span style={{ color: getProfitColor(summary.totalProfit) }}>
                        {formatCurrency(summary.totalProfit, summary.totalProfit < 0)}
                      </span>
                    }
                    subtitle={`${summary.profitMargin}% margin`}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
                  <MetricCard label="Total Miles" value={`${summary.totalMiles.toLocaleString()} mi`} />
                  <MetricCard label="Avg RPM" value={formatCurrency(summary.avgRPM)} />
                  <MetricCard label="Avg CPM" value={formatCurrency(totalExpensesWithFactoring / summary.totalMiles)} />
                  
                  <div 
                    onClick={() => setShowExpenseModal('combined')}
                    style={{
                      backgroundColor: 'white',
                      borderRadius: '12px',
                      padding: '24px',
                      border: '1px solid #e5e7eb',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = '#2563eb'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}>
                    <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                      <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: '600', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Fixed CPM
                      </div>
                      <div style={{ fontSize: '28px', fontWeight: '700', color: '#111827' }}>
                        {formatCurrency(fixedExpenses / summary.totalMiles)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', position: 'relative' }}>
                      <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: '600', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Variable CPM
                      </div>
                      <div style={{ fontSize: '28px', fontWeight: '700', color: '#111827' }}>
                        {formatCurrency(variableExpenses / summary.totalMiles)}
                      </div>
                      <span style={{ position: 'absolute', right: '-8px', top: '50%', transform: 'translateY(-50%)', fontSize: '18px', color: '#6b7280' }}>›</span>
                    </div>
                  </div>
                </div>

                <div style={{
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  border: '1px solid #e5e7eb',
                  overflow: 'hidden'
                }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#111827' }}>
                      Driver Performance
                    </h3>
                  </div>

                  <table style={{ width: '100%', fontSize: '13px' }}>
                    <thead style={{ backgroundColor: '#fafafa', borderBottom: '1px solid #e5e7eb' }}>
                      <tr>
                        <th style={{ padding: '10px 20px', textAlign: 'left', fontWeight: '600', color: '#6b7280', fontSize: '11px', textTransform: 'uppercase' }}>Driver</th>
                        <th style={{ padding: '10px 20px', textAlign: 'right', fontWeight: '600', color: '#6b7280', fontSize: '11px', textTransform: 'uppercase' }}>Revenue</th>
                        <th 
                          onClick={() => setShowExpenseModal('combined')}
                          style={{ padding: '10px 20px', textAlign: 'right', fontWeight: '600', color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', cursor: 'pointer' }}>
                          Fixed
                        </th>
                        <th 
                          onClick={() => setShowExpenseModal('combined')}
                          style={{ padding: '10px 20px', textAlign: 'right', fontWeight: '600', color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', cursor: 'pointer' }}>
                          Variable
                        </th>
                        <th style={{ padding: '10px 20px', textAlign: 'right', fontWeight: '600', color: '#6b7280', fontSize: '11px', textTransform: 'uppercase' }}>Profit</th>
                        <th style={{ padding: '10px 20px', textAlign: 'right', fontWeight: '600', color: '#6b7280', fontSize: '11px', textTransform: 'uppercase' }}>Miles</th>
                        <th style={{ padding: '10px 20px', textAlign: 'right', fontWeight: '600', color: '#6b7280', fontSize: '11px', textTransform: 'uppercase' }}>RPM</th>
                        <th style={{ padding: '10px 20px', textAlign: 'right', fontWeight: '600', color: '#6b7280', fontSize: '11px', textTransform: 'uppercase' }}>CPM</th>
                        <th style={{ padding: '10px 20px', textAlign: 'right', fontWeight: '600', color: '#6b7280', fontSize: '11px', textTransform: 'uppercase' }}>Loads</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.drivers.map((driver, idx) => {
                        const driverFactoringFee = driver.grossRevenue * (summary.factoringRate / 100);
                        const actualFixedExpenses = getDriverFixedExpenses(driver.driverName);
                        const actualVariableExpenses = getDriverVariableExpenses(driver.driverName);
                        const driverVariableWithFactoring = actualVariableExpenses + driverFactoringFee + (driver.driverPay || 0);
                        const driverTotalExpenses = actualFixedExpenses + driverVariableWithFactoring;
                        const driverCPM = driverTotalExpenses / driver.totalMiles;
                        const driverProfit = driver.grossRevenue - driverTotalExpenses;
                        
                        return (
                          <tr
                            key={idx}
                            style={{
                              borderBottom: '1px solid #f3f4f6',
                              cursor: 'pointer'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fafafa'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                            <td 
                              onClick={() => setActiveTab(driver.driverName)}
                              style={{ padding: '12px 20px', fontWeight: '600', color: '#111827' }}>
                              {driver.driverName}
                            </td>
                            <td onClick={() => setActiveTab(driver.driverName)} style={{ padding: '12px 20px', textAlign: 'right', color: '#111827' }}>{formatCurrency(driver.grossRevenue)}</td>
                            <td 
                              onClick={(e) => { e.stopPropagation(); setShowExpenseModal('combined'); }}
                              style={{ padding: '12px 20px', textAlign: 'right', color: '#dc2626' }}>{formatCurrency(actualFixedExpenses, true)}</td>
                            <td 
                              onClick={(e) => { e.stopPropagation(); setShowExpenseModal('combined'); }}
                              style={{ padding: '12px 20px', textAlign: 'right', color: '#dc2626' }}>{formatCurrency(driverVariableWithFactoring, true)}</td>
                            <td onClick={() => setActiveTab(driver.driverName)} style={{ padding: '12px 20px', textAlign: 'right', fontWeight: '700', color: getProfitColor(driverProfit) }}>
                              {formatCurrency(driverProfit, driverProfit < 0)}
                            </td>
                            <td onClick={() => setActiveTab(driver.driverName)} style={{ padding: '12px 20px', textAlign: 'right', color: '#111827' }}>{driver.totalMiles.toLocaleString()}</td>
                            <td onClick={() => setActiveTab(driver.driverName)} style={{ padding: '12px 20px', textAlign: 'right', color: '#111827' }}>{formatCurrency(driver.rpm)}</td>
                            <td onClick={() => setActiveTab(driver.driverName)} style={{ padding: '12px 20px', textAlign: 'right', color: '#111827' }}>{formatCurrency(driverCPM)}</td>
                            <td onClick={() => setActiveTab(driver.driverName)} style={{ padding: '12px 20px', textAlign: 'right', color: '#111827' }}>{driver.loads.length}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : currentDriver ? (
              <>
                {(() => {
                  const driverFactoringFee = currentDriver.grossRevenue * (summary.factoringRate / 100);
                  const actualFixedExpenses = getDriverFixedExpenses(currentDriver.driverName);
                  const actualVariableExpenses = getDriverVariableExpenses(currentDriver.driverName);
                  const driverVariableWithFactoring = actualVariableExpenses + driverFactoringFee + (currentDriver.driverPay || 0);
                  const driverTotalExpenses = actualFixedExpenses + driverVariableWithFactoring;
                  const driverCPM = driverTotalExpenses / currentDriver.totalMiles;
                  const driverProfit = currentDriver.grossRevenue - driverTotalExpenses;
                  
                  return (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                        <MetricCard label="Revenue" value={formatCurrency(currentDriver.grossRevenue)} />
                        <MetricCard 
                          label="Expenses" 
                          value={<span style={{ color: '#dc2626' }}>{formatCurrency(driverTotalExpenses, true)}</span>}
                          subtitle={`Fixed: ${formatCurrency(actualFixedExpenses, true)} | Variable: ${formatCurrency(driverVariableWithFactoring, true)}`}
                          onClick={() => setShowExpenseModal('combined')}
                        />
                        <MetricCard 
                          label="Net Profit" 
                          value={<span style={{ color: getProfitColor(driverProfit) }}>{formatCurrency(driverProfit, driverProfit < 0)}</span>}
                          subtitle={`${((driverProfit / currentDriver.grossRevenue) * 100).toFixed(1)}% margin`} 
                        />
                        <MetricCard 
                          label="Miles" 
                          value={`${currentDriver.totalMiles.toLocaleString()} mi`} 
                          subtitle={`RPM: ${formatCurrency(currentDriver.rpm)} | CPM: ${formatCurrency(driverCPM)}`} 
                        />
                      </div>

                      <div style={{ 
                        backgroundColor: 'white', 
                        borderRadius: '12px', 
                        border: '1px solid #e5e7eb', 
                        padding: '16px 20px',
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <div>
                          <label style={{ fontSize: '13px', fontWeight: '600', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                            Driver Pay Rate (per mile)
                          </label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '18px', fontWeight: '600', color: '#111827' }}>$</span>
                            <input
                            type="number"
                            step="0.01"
                            value={editingPayRate?.driver === currentDriver.driverName ? editingPayRate.rate : (currentDriver.payRate || '')}
                            onChange={(e) => setEditingPayRate({ driver: currentDriver.driverName, rate: e.target.value })}
                            onBlur={() => {
                              if (editingPayRate) {
                                handleUpdatePayRate(editingPayRate.driver, parseFloat(editingPayRate.rate) || 0);
                                setEditingPayRate(null);
                              }
                            }}
                            style={{
                              width: '100px',
                              padding: '8px 12px',
                              border: '1px solid #e5e7eb',
                              borderRadius: '6px',
                              fontSize: '16px',
                              fontWeight: '600',
                              backgroundColor: 'white',
                              color: '#111827'
                            }}
                          />
                            <span style={{ fontSize: '13px', color: '#6b7280' }}>× {currentDriver.totalMiles.toLocaleString()} mi</span>
                            <span style={{ fontSize: '16px', fontWeight: '700', color: '#dc2626', marginLeft: '12px' }}>
                              = {formatCurrency(currentDriver.driverPay || 0, true)}
                            </span>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>TOTAL DRIVER PAY</div>
                          <div style={{ fontSize: '24px', fontWeight: '700', color: '#dc2626' }}>
                            {formatCurrency(currentDriver.driverPay || 0, true)}
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}

                <div style={{
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  border: '1px solid #e5e7eb',
                  overflow: 'hidden'
                }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#111827' }}>
                      Loads ({currentDriver.loads.length})
                    </h3>
                  </div>

                  <table style={{ width: '100%', fontSize: '13px' }}>
                    <thead style={{ backgroundColor: '#fafafa', borderBottom: '1px solid #e5e7eb' }}>
                      <tr>
                        <th style={{ padding: '10px 20px', textAlign: 'left', fontWeight: '600', color: '#6b7280', fontSize: '11px', textTransform: 'uppercase' }}>Load #</th>
                        <th style={{ padding: '10px 20px', textAlign: 'left', fontWeight: '600', color: '#6b7280', fontSize: '11px', textTransform: 'uppercase' }}>Pickup</th>
                        <th style={{ padding: '10px 20px', textAlign: 'left', fontWeight: '600', color: '#6b7280', fontSize: '11px', textTransform: 'uppercase' }}>Dropoff</th>
                        <th style={{ padding: '10px 20px', textAlign: 'right', fontWeight: '600', color: '#6b7280', fontSize: '11px', textTransform: 'uppercase' }}>Amount</th>
                        <th style={{ padding: '10px 20px', textAlign: 'right', fontWeight: '600', color: '#6b7280', fontSize: '11px', textTransform: 'uppercase' }}>Miles</th>
                        <th style={{ padding: '10px 20px', textAlign: 'right', fontWeight: '600', color: '#6b7280', fontSize: '11px', textTransform: 'uppercase' }}>RPM</th>
                        <th style={{ padding: '10px 20px', textAlign: 'right', fontWeight: '600', color: '#6b7280', fontSize: '11px', textTransform: 'uppercase' }}>Date</th>
                        <th style={{ padding: '10px 20px', textAlign: 'center', fontWeight: '600', color: '#6b7280', fontSize: '11px', textTransform: 'uppercase' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentDriver.loads.map((load) => (
                        <tr
                          key={load.id}
                          style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '12px 20px', fontWeight: '600', color: '#111827' }}>{load.loadNumber}</td>
                          <td style={{ padding: '12px 20px', color: '#111827' }}>{load.pickupLocation || '-'}</td>
                          <td style={{ padding: '12px 20px', color: '#111827' }}>{load.dropoffLocation || '-'}</td>
                          <td style={{ padding: '12px 20px', textAlign: 'right', color: '#111827' }}>{formatCurrency(load.grossAmount)}</td>
                          <td style={{ padding: '12px 20px', textAlign: 'right', color: '#111827' }}>{load.miles ? load.miles.toLocaleString() : '-'}</td>
                          <td style={{ padding: '12px 20px', textAlign: 'right', color: '#111827' }}>{formatCurrency(load.ratePerMile)}</td>
                          <td style={{ padding: '12px 20px', textAlign: 'right', color: '#111827' }}>
                            {load.pickupDate ? new Date(load.pickupDate).toLocaleDateString() : '-'}
                          </td>
                          <td style={{ padding: '12px 20px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                              <button
                                onClick={() => {
                                  setSelectedLoad(load);
                                  setShowReassignModal(true);
                                }}
                                style={{
                                  padding: '6px',
                                  backgroundColor: 'transparent',
                                  color: '#2563eb',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dbeafe'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                title="Reassign to another driver">
                                ↔️
                              </button>
                              <button
                                onClick={() => handleDeleteLoad(load.id)}
                                style={{
                                  padding: '6px',
                                  backgroundColor: 'transparent',
                                  color: '#dc2626',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}