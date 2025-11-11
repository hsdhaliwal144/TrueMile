import { useState, useEffect } from 'react';
import { Home, TrendingUp, Database, BarChart3, Mail, GraduationCap, Send, MoreVertical, DollarSign, Truck } from 'lucide-react';
import BrokerIntelligenceDashboard from '../components/BrokerIntelligenceDashboard';
import BrokerOutreachDashboard from '../components/BrokerOutreachDashboard';
import LoadOptimizer from './LoadOptimizer';
import FleetFinancials from './FleetFinancials';
import { API_URL } from '../config';
import { Calculator } from 'lucide-react';
import DispatchEngine from './DispatchEngine.tsx';

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

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface DashboardData {
  grossRevenue: number;
  totalExpenses: number;
  netProfit: number;
  totalMiles: number;
  avgRPM: number;
  avgCPM: number;
  fixedCPM: number;
  variableCPM: number;
  profitMargin: number;
  drivers: Array<{
    name: string;
    revenue: number;
    fixedExpenses: number;
    variableExpenses: number;
    profit: number;
    miles: number;
    rpm: number;
    cpm: number;
    loads: number;
  }>;
}

interface RigbyChatPanelProps {
  chatExpanded: boolean;
  setChatExpanded: (expanded: boolean) => void;
  messages: Message[];
  input: string;
  setInput: (input: string) => void;
  sendMessage: () => void;
  loading: boolean;
}

const RigbyChatPanel = ({ 
  chatExpanded, 
  setChatExpanded, 
  messages, 
  input, 
  setInput, 
  sendMessage, 
  loading 
}: RigbyChatPanelProps) => (
  <div style={{ 
    width: chatExpanded ? '320px' : '60px',
    backgroundColor: '#fafbfc',
    borderLeft: '1px solid #e5e7eb', 
    display: 'flex', 
    flexDirection: 'column',
    height: '100vh',
    position: 'fixed',
    right: 0,
    top: 0,
    transition: 'width 0.3s'
  }}>
    <div style={{ 
      padding: '20px', 
      borderBottom: '1px solid #e5e7eb', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between', 
      backgroundColor: 'white',
      cursor: 'pointer'
    }} onClick={() => setChatExpanded(!chatExpanded)}>
      {chatExpanded ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}></span>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#111827' }}>Chat with Rigby</h2>
          </div>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
            <MoreVertical size={18} />
          </button>
        </>
      ) : (
        <span style={{ fontSize: '24px' }}></span>
      )}
    </div>

    {chatExpanded && (
      <>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {messages.map((msg, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '80%',
                padding: '10px 14px',
                borderRadius: '16px',
                backgroundColor: msg.role === 'user' ? '#2563eb' : 'white',
                color: msg.role === 'user' ? 'white' : '#111827',
                fontSize: '14px',
                lineHeight: '1.5',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
              }}>
                {msg.content}
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: '20px', borderTop: '1px solid #e5e7eb', backgroundColor: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: '12px', padding: '10px 14px', border: '1px solid #e5e7eb' }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Type a message..."
              style={{
                flex: 1,
                backgroundColor: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: '14px',
                color: '#111827'
              }}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: loading || !input.trim() ? '#d1d5db' : '#2563eb',
                marginLeft: '8px'
              }}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </>
    )}
  </div>
);

export default function RigbyPage() {
  const [activeTab, setActiveTab] = useState('fleet-financials');
  const [metrics, setMetrics] = useState<FleetMetrics>({
    trucks: 0,
    drivers: 0,
    loadsPerMonth: 0,
    milesPerMonth: 0,
    fuelCost: 0,
    insurance: 0,
    maintenance: 0,
    otherExpenses: 0
  });
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hello! How can I assist you?" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(true);

  useEffect(() => {
    loadFleetData();
    loadDashboardData();
  }, []);

  const loadFleetData = async () => {
    try {
      const response = await fetch(`${API_URL}/api/fleet`);
      const data = await response.json();
      if (data.success) {
        setMetrics(data.metrics);
      }
    } catch (error) {
      console.error('Failed to load fleet data:', error);
    }
  };

  const loadDashboardData = async () => {
    try {
      const [dashboardRes, expensesRes] = await Promise.all([
        fetch(`${API_URL}/api/profit-engine/dashboard?period=ytd&factoringRate=2.2`),
        fetch(`${API_URL}/api/profit-engine/expenses-by-driver?period=ytd`)
      ]);
      
      const dashboard = await dashboardRes.json();
      const expenses = await expensesRes.json();
      
      if (dashboard.success && dashboard.summary) {
        const summary = dashboard.summary;
        const expensesByDriver = expenses.success ? expenses.expensesByDriver : {};
        
        // Helper to get expense amounts (matching FleetFinancials logic)
        const getExpenseAmount = (driverName: string, expenseType: string) => {
          return expensesByDriver[driverName]?.[expenseType] || 0;
        };
        
        const getDriverFixedExpenses = (driverName: string) => {
          const fixed = ['insurance', 'truck_payment', 'trailer_payment', 'cpa', 'eld', 'prepass', 'load_board', 'ifta', 'compliance', 'payroll_tax', 'business_tax', 'interest_payments'];
          return fixed.reduce((sum, type) => sum + getExpenseAmount(driverName, type), 0);
        };
        
        const getDriverVariableExpenses = (driverName: string) => {
          const variable = ['repair', 'maintenance', 'fuel', 'misc', 'food', 'lumper', 'toll', 'scales'];
          return variable.reduce((sum, type) => sum + getExpenseAmount(driverName, type), 0);
        };
        
        // Calculate overall metrics
        const fixedExpenses = summary.drivers.reduce((sum: number, d: any) => sum + getDriverFixedExpenses(d.driverName), 0);
        const variableExpenses = summary.drivers.reduce((sum: number, d: any) => {
          const driverFactoring = d.grossRevenue * (summary.factoringRate / 100);
          return sum + getDriverVariableExpenses(d.driverName) + driverFactoring;
        }, 0);
        const totalExpenses = fixedExpenses + variableExpenses;
        
        setDashboardData({
          grossRevenue: summary.totalRevenue || 0,
          totalExpenses: totalExpenses,
          netProfit: summary.totalRevenue - totalExpenses,
          totalMiles: summary.totalMiles || 0,
          avgRPM: summary.avgRPM || 0,
          avgCPM: totalExpenses / (summary.totalMiles || 1),
          fixedCPM: fixedExpenses / (summary.totalMiles || 1),
          variableCPM: variableExpenses / (summary.totalMiles || 1),
          profitMargin: summary.totalRevenue > 0 ? ((summary.totalRevenue - totalExpenses) / summary.totalRevenue * 100) : 0,
          drivers: summary.drivers.map((d: any) => {
            const driverFactoring = d.grossRevenue * (summary.factoringRate / 100);
            const driverFixed = getDriverFixedExpenses(d.driverName);
            const driverVariable = getDriverVariableExpenses(d.driverName);
            const driverTotalExpenses = driverFixed + driverVariable + driverFactoring;
            const driverProfit = d.grossRevenue - driverTotalExpenses;
            
            return {
              name: d.driverName,
              revenue: d.grossRevenue || 0,
              fixedExpenses: driverFixed,
              variableExpenses: driverVariable + driverFactoring,
              profit: driverProfit,
              miles: d.totalMiles || 0,
              rpm: d.rpm || 0,
              cpm: d.totalMiles > 0 ? driverTotalExpenses / d.totalMiles : 0,
              loads: d.loads?.length || 0
            };
          })
        });
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    
    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/rigby/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content: userMessage }],
          currentMetrics: metrics,
          dashboardData: dashboardData
        })
      });

      const data = await response.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);

      if (data.updatedMetrics) {
        setMetrics(prev => ({ ...prev, ...data.updatedMetrics }));
        await fetch(`${API_URL}/api/fleet`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...metrics, ...data.updatedMetrics })
        });
      }
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I had trouble with that. Can you try again?' 
      }]);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'fleet-financials', label: 'Fleet Financials', icon: DollarSign },
    { id: 'dispatch-engine', label: 'Dispatch Engine', icon: TrendingUp },
    { id: 'load-optimizer', label: 'Load Optimizer', icon: Truck },
    { id: 'broker-intelligence', label: 'Broker Intelligence', icon: BarChart3 },
    { id: 'broker-connect', label: 'Broker Connect', icon: Mail },
    { id: 'tms', label: 'TMS', icon: Database },
    { id: 'education', label: 'Education', icon: GraduationCap },
  ];

  const renderLogo = () => (
    <svg width="40" height="40" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 85 L45 30 L45 85 Z" fill="url(#gradient1)" />
      <path d="M55 30 L80 85 L55 85 Z" fill="url(#gradient2)" />
      <line x1="50" y1="25" x2="50" y2="85" stroke="url(#gradient3)" strokeWidth="3" />
      <defs>
        <linearGradient id="gradient1" x1="20" y1="30" x2="45" y2="85" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1e3a8a" />
          <stop offset="1" stopColor="#3b82f6" />
        </linearGradient>
        <linearGradient id="gradient2" x1="55" y1="30" x2="80" y2="85" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3b82f6" />
          <stop offset="1" stopColor="#1e3a8a" />
        </linearGradient>
        <linearGradient id="gradient3" x1="50" y1="25" x2="50" y2="85" gradientUnits="userSpaceOnUse">
          <stop stopColor="#60a5fa" />
          <stop offset="0.5" stopColor="#93c5fd" />
          <stop offset="1" stopColor="#60a5fa" />
        </linearGradient>
      </defs>
    </svg>
  );

  // Sidebar component
  const Sidebar = () => (
    <div style={{ 
      width: '240px', 
      backgroundColor: 'white', 
      borderRight: '1px solid #e5e7eb', 
      display: 'flex', 
      flexDirection: 'column',
      height: '100vh',
      position: 'fixed',
      left: 0,
      top: 0
    }}>
      <div style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {renderLogo()}
          <div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827', lineHeight: '1.2' }}>TrueMile.AI</div>
            <div style={{ fontSize: '9px', color: '#6b7280', letterSpacing: '0.02em' }}>See the truth behind every mile.</div>
          </div>
        </div>
      </div>
      
      <nav style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 12px',
                borderRadius: '12px',
                border: isActive ? '1px solid #dbeafe' : '1px solid transparent',
                backgroundColor: isActive ? '#eff6ff' : 'transparent',
                color: isActive ? '#2563eb' : '#6b7280',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: isActive ? '600' : '500',
                width: '100%',
                textAlign: 'left',
                transition: 'all 0.2s',
                boxShadow: isActive ? '0 1px 2px rgba(37, 99, 235, 0.1)' : 'none'
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = '#f9fafb';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <Icon size={20} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );

  return (
    <div style={{ 
      display: 'flex', 
      height: '100vh',
      width: '100vw',
      backgroundColor: '#f9fafb',
      position: 'fixed',
      top: 0,
      left: 0,
      overflow: 'hidden'
    }}>
      <Sidebar />

      {/* Main Content Area */}
      <div style={{ 
        marginLeft: '240px',
        marginRight: chatExpanded ? '320px' : '60px',
        flex: 1,
        height: '100vh',
        overflowY: 'auto',
        transition: 'margin-right 0.3s'
      }}>
        {/* Fleet Financials - NEW COMPONENT */}
        {activeTab === 'fleet-financials' && <FleetFinancials />}

              {/* Dispatch Engine (NEW - AI route planning) */}
        {activeTab === 'dispatch-engine' && (
          <DispatchEngine />
)}

        {/* Load Optimizer */}
        {activeTab === 'load-optimizer' && <LoadOptimizer />}

        {/* Broker Intelligence */}
        {activeTab === 'broker-intelligence' && <BrokerIntelligenceDashboard />}

        {/* Broker Connect (formerly Broker Outreach) */}
        {activeTab === 'broker-connect' && <BrokerOutreachDashboard />}

        {/* Other Tabs */}
        {['tms', 'education'].includes(activeTab) && (
          <div style={{ 
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', marginBottom: '8px', textTransform: 'capitalize' }}>
                {activeTab.replace('-', ' ')}
              </h2>
              <p style={{ color: '#6b7280' }}>Coming soon...</p>
            </div>
          </div>
        )}
      </div>

      {/* Persistent Rigby Chat */}
      <RigbyChatPanel
        chatExpanded={chatExpanded}
        setChatExpanded={setChatExpanded}
        messages={messages}
        input={input}
        setInput={setInput}
        sendMessage={sendMessage}
        loading={loading}
      />
    </div>
  );
}