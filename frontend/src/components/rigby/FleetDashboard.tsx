import { useState } from 'react';
import { Edit2, Save, Truck, DollarSign, TrendingUp } from 'lucide-react';

interface FleetMetrics {
  trucks: number;
  drivers: number;
  loadsPerMonth: number;
  milesPerMonth: number;
  fuelCost: number;
  insurance: number;
  maintenance: number;
  otherExpenses: number;
}

interface FleetDashboardProps {
  metrics: FleetMetrics;
  onMetricsUpdate: (metrics: FleetMetrics) => void;
}

export default function FleetDashboard({ metrics, onMetricsUpdate }: FleetDashboardProps) {
  const [editMode, setEditMode] = useState(false);
  const [tempMetrics, setTempMetrics] = useState<FleetMetrics>(metrics);

  const calculateFinancials = () => {
    const totalExpenses = metrics.fuelCost + metrics.insurance + metrics.maintenance + metrics.otherExpenses;
    const cpm = metrics.milesPerMonth > 0 ? totalExpenses / metrics.milesPerMonth : 0;
    const estimatedRevenue = metrics.loadsPerMonth * 2500;
    const rpm = metrics.milesPerMonth > 0 ? estimatedRevenue / metrics.milesPerMonth : 0;
    const profitPerMile = rpm - cpm;
    const monthlyProfit = profitPerMile * metrics.milesPerMonth;

    return { cpm, rpm, profitPerMile, monthlyProfit, totalExpenses, estimatedRevenue };
  };

  const handleEdit = () => {
    setEditMode(true);
    setTempMetrics(metrics);
  };

  const handleCancel = () => {
    setEditMode(false);
    setTempMetrics(metrics);
  };

  const handleSave = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/fleet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tempMetrics)
      });

      const data = await response.json();
      if (data.success) {
        onMetricsUpdate(tempMetrics);
        setEditMode(false);
      } else {
        alert('Failed to save changes');
      }
    } catch (error) {
      alert('Error saving changes. Please try again.');
    }
  };

  const financials = calculateFinancials();

  return (
    <div className="w-96 bg-gray-50 overflow-y-auto">
      {/* Header */}
      <div className="p-4 bg-white border-b border-gray-200 flex justify-between items-center">
        <h2 className="text-lg font-bold">Fleet Snapshot</h2>
        {!editMode ? (
          <button
            onClick={handleEdit}
            className="text-blue-600 hover:text-blue-700 flex items-center space-x-1 transition-colors"
          >
            <Edit2 size={18} />
            <span className="text-sm">Edit</span>
          </button>
        ) : (
          <div className="flex space-x-2">
            <button
              onClick={handleCancel}
              className="text-gray-600 hover:text-gray-700 text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="bg-blue-600 text-white px-3 py-1 rounded text-sm flex items-center space-x-1 hover:bg-blue-700 transition-colors"
            >
              <Save size={16} />
              <span>Save</span>
            </button>
          </div>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Fleet Overview */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center space-x-2 mb-3">
            <Truck className="text-blue-600" size={20} />
            <h3 className="font-semibold">Fleet Overview</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Trucks:</span>
              {editMode ? (
                <input
                  type="number"
                  value={tempMetrics.trucks}
                  onChange={(e) => setTempMetrics({...tempMetrics, trucks: parseInt(e.target.value) || 0})}
                  className="w-20 px-2 py-1 border rounded text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
              ) : (
                <span className="font-semibold">{metrics.trucks}</span>
              )}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Drivers:</span>
              {editMode ? (
                <input
                  type="number"
                  value={tempMetrics.drivers}
                  onChange={(e) => setTempMetrics({...tempMetrics, drivers: parseInt(e.target.value) || 0})}
                  className="w-20 px-2 py-1 border rounded text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
              ) : (
                <span className="font-semibold">{metrics.drivers}</span>
              )}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Loads/Month:</span>
              {editMode ? (
                <input
                  type="number"
                  value={tempMetrics.loadsPerMonth}
                  onChange={(e) => setTempMetrics({...tempMetrics, loadsPerMonth: parseInt(e.target.value) || 0})}
                  className="w-20 px-2 py-1 border rounded text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
              ) : (
                <span className="font-semibold">{metrics.loadsPerMonth}</span>
              )}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Miles/Month:</span>
              {editMode ? (
                <input
                  type="number"
                  value={tempMetrics.milesPerMonth}
                  onChange={(e) => setTempMetrics({...tempMetrics, milesPerMonth: parseInt(e.target.value) || 0})}
                  className="w-20 px-2 py-1 border rounded text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
              ) : (
                <span className="font-semibold">{metrics.milesPerMonth.toLocaleString()}</span>
              )}
            </div>
          </div>
        </div>

        {/* Financial Health */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center space-x-2 mb-3">
            <DollarSign className="text-green-600" size={20} />
            <h3 className="font-semibold">Financial Health</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">CPM:</span>
              <span className="font-semibold">${financials.cpm.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">RPM:</span>
              <span className="font-semibold">${financials.rpm.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Profit/Mile:</span>
              <span className={`font-semibold ${financials.profitPerMile > 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${financials.profitPerMile.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t">
              <span className="text-gray-600">Monthly Profit:</span>
              <span className={`font-bold ${financials.monthlyProfit > 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${financials.monthlyProfit.toLocaleString(undefined, {maximumFractionDigits: 0})}
              </span>
            </div>
          </div>
        </div>

        {/* Monthly Expenses */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center space-x-2 mb-3">
            <TrendingUp className="text-purple-600" size={20} />
            <h3 className="font-semibold">Monthly Expenses</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Fuel:</span>
              {editMode ? (
                <input
                  type="number"
                  value={tempMetrics.fuelCost}
                  onChange={(e) => setTempMetrics({...tempMetrics, fuelCost: parseFloat(e.target.value) || 0})}
                  className="w-24 px-2 py-1 border rounded text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                  step="100"
                />
              ) : (
                <span className="font-semibold">${metrics.fuelCost.toLocaleString()}</span>
              )}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Insurance:</span>
              {editMode ? (
                <input
                  type="number"
                  value={tempMetrics.insurance}
                  onChange={(e) => setTempMetrics({...tempMetrics, insurance: parseFloat(e.target.value) || 0})}
                  className="w-24 px-2 py-1 border rounded text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                  step="100"
                />
              ) : (
                <span className="font-semibold">${metrics.insurance.toLocaleString()}</span>
              )}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Maintenance:</span>
              {editMode ? (
                <input
                  type="number"
                  value={tempMetrics.maintenance}
                  onChange={(e) => setTempMetrics({...tempMetrics, maintenance: parseFloat(e.target.value) || 0})}
                  className="w-24 px-2 py-1 border rounded text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                  step="100"
                />
              ) : (
                <span className="font-semibold">${metrics.maintenance.toLocaleString()}</span>
              )}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Other:</span>
              {editMode ? (
                <input
                  type="number"
                  value={tempMetrics.otherExpenses}
                  onChange={(e) => setTempMetrics({...tempMetrics, otherExpenses: parseFloat(e.target.value) || 0})}
                  className="w-24 px-2 py-1 border rounded text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                  step="100"
                />
              ) : (
                <span className="font-semibold">${metrics.otherExpenses.toLocaleString()}</span>
              )}
            </div>
            <div className="flex justify-between pt-2 border-t font-bold">
              <span className="text-sm">Total:</span>
              <span>${financials.totalExpenses.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* AI Insights */}
        {metrics.trucks > 0 && (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-2">💡 Rigby's Insights</h3>
            <ul className="space-y-2 text-sm text-blue-800">
              {financials.cpm > 2.0 && (
                <li>• CPM is ${financials.cpm.toFixed(2)} — industry avg is $1.80. Let's optimize costs.</li>
              )}
              {financials.profitPerMile < 0.3 && financials.profitPerMile > 0 && (
                <li>• Profit margin is thin. Let's find better paying lanes or reduce expenses.</li>
              )}
              {metrics.loadsPerMonth < metrics.trucks * 8 && metrics.trucks > 0 && (
                <li>• Trucks could handle more loads. Current avg: {(metrics.loadsPerMonth / metrics.trucks).toFixed(1)} loads/truck.</li>
              )}
              {financials.cpm <= 1.8 && (
                <li>• Great CPM! You're operating efficiently compared to industry standards.</li>
              )}
              {financials.profitPerMile > 1.0 && (
                <li>• Strong profit margins! You're doing great. Consider expanding your fleet.</li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}