import React, { useState, useEffect } from 'react';
import { apiEndpoints } from '../config';
import { API_URL } from '../config';

interface OutreachDraft {
  id: number;
  brokerName: string;
  recipientEmail: string;
  subject: string;
  body: string;
  emailType: string;
  reasoning: string;
  status: string;
  createdAt: string;
  sentAt?: string;
  repliedAt?: string;
  gmailMessageId?: string;
}

interface OutreachStats {
  totalDrafts: number;
  totalSent: number;
  totalReplied: number;
  replyRate: string;
}

interface BrokerIntel {
  broker: string;
  totalLoads: number;
  avgRatePerMile: number;
  topLanes: string[];
  relationshipScore: number;
}

interface GroupedBroker {
  name: string;
  email: string;
  drafts: OutreachDraft[];
  intel?: BrokerIntel;
}

export const BrokerOutreachDashboard: React.FC = () => {
  const [drafts, setDrafts] = useState<OutreachDraft[]>([]);
  const [brokerIntel, setBrokerIntel] = useState<BrokerIntel[]>([]);
  const [stats, setStats] = useState<OutreachStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState<number | null>(null);
  const [sendingBroker, setSendingBroker] = useState<string | null>(null);
  const [selectedDraft, setSelectedDraft] = useState<OutreachDraft | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');
  const [expandedBrokers, setExpandedBrokers] = useState<Set<string>>(new Set());
  const [brokerRankings, setBrokerRankings] = useState<any[]>([]);

  useEffect(() => {
  fetchBrokerRankings();  // ADD THIS LINE
  fetchDrafts();
  fetchStats();
  fetchBrokerIntel();
}, []);
  const fetchDrafts = async () => {
    setLoading(true);
    try {
      const response = await fetch(apiEndpoints.brokerOutreach.drafts());
      const data = await response.json();
      if (data.success) {
        setDrafts(data.drafts);
      }
    } catch (error) {
      console.error('Error fetching drafts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(apiEndpoints.brokerOutreach.stats);
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchBrokerIntel = async () => {
    try {
      const response = await fetch(apiEndpoints.brokerIntelligence.brokers);
      const data = await response.json();
      if (data.success) {
        setBrokerIntel(data.brokers);
      }
    } catch (error) {
      console.error('Error fetching broker intel:', error);
    }
  };

  const generateBatchEmails = async () => {
    if (!confirm('Generate AI emails for top 5 brokers?')) return;

    setGenerating(true);
    try {
      const response = await fetch(apiEndpoints.brokerOutreach.generateBatch, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 5 })
      });
      
      const data = await response.json();
      if (data.success) {
        alert(`✅ Generated ${data.count} emails!`);
        fetchDrafts();
        fetchStats();
      }
    } catch (error) {
      console.error('Error generating emails:', error);
      alert('❌ Failed to generate emails');
    } finally {
      setGenerating(false);
    }
  };

  const viewDraft = (draft: OutreachDraft) => {
    setSelectedDraft(draft);
    setEditedSubject(draft.subject);
    setEditedBody(draft.body);
    setEditMode(false);
    setShowModal(true);
  };

  const saveEdits = async () => {
    if (!selectedDraft) return;

    try {
      const response = await fetch(apiEndpoints.brokerOutreach.updateDraft(selectedDraft.id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: editedSubject,
          body: editedBody
        })
      });

      const data = await response.json();
      if (data.success) {
        alert('✅ Email updated!');
        setEditMode(false);
        fetchDrafts();
        setShowModal(false);
      }
    } catch (error) {
      console.error('Error saving edits:', error);
      alert('❌ Failed to save edits');
    }
  };

  const approveAndSend = async (id: number) => {
    setSending(id);
    try {
      await fetch(apiEndpoints.brokerOutreach.updateDraft(id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' })
      });

      const response = await fetch(apiEndpoints.brokerOutreach.sendDraft(id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();
      if (data.success) {
        alert('✅ Email sent successfully!');
        fetchDrafts();
        fetchStats();
        setShowModal(false);
      } else {
        alert(`❌ Failed to send: ${data.error}`);
      }
    } catch (error) {
      console.error('Error sending email:', error);
      alert('❌ Failed to send email');
    } finally {
      setSending(null);
    }
  };

  const toggleBrokerExpand = (brokerName: string) => {
    const newExpanded = new Set(expandedBrokers);
    if (newExpanded.has(brokerName)) {
      newExpanded.delete(brokerName);
    } else {
      newExpanded.add(brokerName);
    }
    setExpandedBrokers(newExpanded);
  };

  const groupDraftsByBroker = (): GroupedBroker[] => {
    const grouped = new Map<string, GroupedBroker>();

    drafts.forEach(draft => {
      if (!grouped.has(draft.brokerName)) {
        const intel = brokerIntel.find(b => b.broker === draft.brokerName);
        grouped.set(draft.brokerName, {
          name: draft.brokerName,
          email: draft.recipientEmail,
          drafts: [],
          intel
        });
      }
      grouped.get(draft.brokerName)!.drafts.push(draft);
    });

    return Array.from(grouped.values()).sort((a, b) => {
      const aScore = a.intel?.relationshipScore || 0;
      const bScore = b.intel?.relationshipScore || 0;
      return bScore - aScore;
    });
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      draft: 'bg-gray-50 text-gray-700',
      approved: 'bg-green-50 text-green-700',
      sent: 'bg-blue-50 text-blue-700',
      replied: 'bg-purple-50 text-purple-700',
    };
    return colors[status as keyof typeof colors] || colors.draft;
  };

// Add new fetch function
const fetchBrokerRankings = async () => {
  try {
    const response = await fetch(`${API_URL}/api/outreach/broker-rankings`);
    const data = await response.json();
    if (data.success) {
      setBrokerRankings(data.brokers);
    }
  } catch (error) {
    console.error('Error fetching broker rankings:', error);
  }
};
return (
  <div style={{ padding: '32px', backgroundColor: '#ffffff', minHeight: '100vh' }}>
    <div style={{ marginBottom: '32px' }}>
      <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '8px', color: '#111827' }}>
       Broker Outreach
      </h1>
      <p style={{ color: '#6b7280' }}>Ranked by highest RPM - click to send outreach</p>
    </div>

    {loading ? (
      <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280' }}>
        Loading brokers...
      </div>
    ) : brokerRankings.length === 0 ? (
      <div style={{ backgroundColor: '#f9fafb', padding: '60px', borderRadius: '12px', textAlign: 'center', border: '1px solid #e5e7eb' }}>
        <p style={{ color: '#6b7280', fontSize: '16px' }}>No broker data found. Upload rate confirmations first.</p>
      </div>
    ) : (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '16px' }}>
        {brokerRankings.map((broker, idx) => (
          <div
            key={idx}
            onClick={async () => {
  if (sendingBroker) return; // Prevent double-clicks
  
  setSendingBroker(broker.brokerName);
  try {
    // Generate draft
    const genResponse = await fetch(apiEndpoints.brokerOutreach.generate, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brokerName: broker.brokerName })
    });
    
    const genData = await genResponse.json();
    
    if (genData.success && genData.draft) {
      // Approve it
      await fetch(apiEndpoints.brokerOutreach.updateDraft(genData.draft.id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' })
      });
      
      // Send it immediately
      const sendResponse = await fetch(apiEndpoints.brokerOutreach.sendDraft(genData.draft.id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const sendData = await sendResponse.json();
      
      if (sendData.success) {
        alert(`✅ Email sent to ${broker.brokerEmail}!`);
      } else {
        alert(`❌ Failed to send: ${sendData.error}`);
      }
    }
    
    fetchDrafts();
  } catch (error) {
    console.error('Error:', error);
    alert('❌ Failed to send email');
  }
            }}
            style={{
              backgroundColor: '#ffffff',
              padding: '20px',
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#2563eb';
              e.currentTarget.style.backgroundColor = '#f9fafb';
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e5e7eb';
              e.currentTarget.style.backgroundColor = '#ffffff';
              e.currentTarget.style.boxShadow = 'none';
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ fontSize: '18px', fontWeight: '600', color: '#111827' }}>
                {broker.brokerName}
              </div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#16a34a' }}>
                ${broker.avgRPM.toFixed(2)}/mi
              </div>
            </div>
            <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px' }}>
              {broker.brokerEmail}
            </div>
            {broker.topPickup && broker.topDropoff && (
              <div style={{ fontSize: '12px', color: '#374151', marginBottom: '8px', padding: '8px', backgroundColor: '#f3f4f6', borderRadius: '6px' }}>
                <div style={{ fontWeight: '500', marginBottom: '4px' }}>Most Common Lane:</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📍 {broker.topPickup}</span>
                  <span style={{ color: '#9ca3af' }}>→</span>
                  <span>📍 {broker.topDropoff}</span>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#6b7280' }}>
              <span>{broker.totalLoads} loads</span>
              <span>${broker.totalRevenue.toLocaleString()} revenue</span>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);
};
export default BrokerOutreachDashboard;