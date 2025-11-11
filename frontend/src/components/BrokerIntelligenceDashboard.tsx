// src/components/BrokerIntelligenceDashboard.tsx

import { useState, useEffect } from 'react';
import axios from 'axios';
import { apiEndpoints } from '../config';
import './BrokerIntelligenceDashboard.css';

interface Load {
  id: string;
  origin: string;
  destination: string;
  distance: number;
  totalRate: number;
  ratePerMile: number;
  equipment: string;
  broker: string;
  brokerEmail: string;
  priorityScore: number;
  fitReason: string;
  extractedAt: string;
  message: {
    id: string;
    subject: string;
    receivedAt: string;
  };
}

interface BrokerStats {
  id: string;
  broker: string;
  brokerEmail: string;
  totalLoads: number;
  loadsThisMonth: number;
  loadsThisWeek: number;
  avgRatePerMile: number;
  highestRate: number;
  lowestRate: number;
  topLanes: Array<{ lane: string; count: number; avgRate: number }>;
  laneCount: number;
  firstContactDate: string;
  lastContactDate: string;
  avgDaysBetween: number;
  relationshipScore: number;
}

interface DashboardStats {
  totalLoads: number;
  highPriorityCount: number;
  avgRate: string;
  topBrokers: BrokerStats[];
}

export default function BrokerIntelligenceDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [priorityLoads, setPriorityLoads] = useState<Load[]>([]);
  const [allBrokers, setAllBrokers] = useState<BrokerStats[]>([]);
  const [selectedBroker, setSelectedBroker] = useState<string | null>(null);
  const [brokerLoads, setBrokerLoads] = useState<Load[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, loadsRes, brokersRes] = await Promise.all([
        axios.get(apiEndpoints.brokerIntelligence.stats),
        axios.get(apiEndpoints.brokerIntelligence.priorityLoads(70)),
        axios.get(apiEndpoints.brokerIntelligence.brokers)
      ]);

      setStats(statsRes.data);
      setPriorityLoads(loadsRes.data);
      setAllBrokers(brokersRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBrokerClick = async (broker: string) => {
    setSelectedBroker(broker);
    try {
      const { data } = await axios.get(apiEndpoints.brokerIntelligence.brokerLoads(broker));
      setBrokerLoads(data);
    } catch (error) {
      console.error('Error fetching broker loads:', error);
    }
  };

  const getPriorityClass = (score: number) => {
    if (score >= 80) return 'priority-excellent';
    if (score >= 60) return 'priority-good';
    return 'priority-pass';
  };

  const getPriorityLabel = (score: number) => {
    if (score >= 80) return '🔥 EXCELLENT';
    if (score >= 60) return '⭐ GOOD';
    return '❄️ PASS';
  };

  const getRelationshipLevel = (score: number) => {
    if (score >= 80) return '🔥 HOT - Contact for direct contract';
    if (score >= 60) return '⭐ WARM - Build relationship';
    return '❄️ COLD - Monitor only';
  };

  if (loading) {
    return <div className="loading">Loading broker intelligence...</div>;
  }

  return (
    <div className="broker-intelligence-dashboard">
      <header className="dashboard-header">
        <h1>Broker Intelligence Dashboard</h1>
        <button onClick={fetchData} className="refresh-btn">🔄 Refresh</button>
      </header>

      {/* Overall Stats */}
      {stats && (
        <section className="stats-overview">
          <div className="stat-card">
            <h3>Total Loads</h3>
            <p className="stat-value">{stats.totalLoads}</p>
          </div>
          <div className="stat-card">
            <h3>High Priority</h3>
            <p className="stat-value priority">{stats.highPriorityCount}</p>
          </div>
          <div className="stat-card">
            <h3>Avg Rate/Mile</h3>
            <p className="stat-value">${stats.avgRate}</p>
          </div>
          <div className="stat-card">
            <h3>Top Brokers</h3>
            <p className="stat-value">{stats.topBrokers.length}</p>
          </div>
        </section>
      )}

      {/* Priority Loads */}
      <section className="priority-loads-section">
        <h2>High Priority Loads (70+ Score)</h2>
        {priorityLoads.length === 0 ? (
          <p className="no-data">No high priority loads yet. System is collecting data...</p>
        ) : (
          <div className="loads-grid">
            {priorityLoads.map(load => (
              <div key={load.id} className={`load-card ${getPriorityClass(load.priorityScore)}`}>
                <div className="load-header">
                  <span className="priority-badge">
                    {getPriorityLabel(load.priorityScore)}
                  </span>
                  <span className="score">{load.priorityScore}</span>
                </div>

                <div className="load-route">
                  <strong>{load.origin}</strong>
                  <span className="arrow">→</span>
                  <strong>{load.destination}</strong>
                  <span className="distance">({load.distance} mi)</span>
                </div>

                <div className="load-rate">
                  <span className="rate-per-mile">${load.ratePerMile?.toFixed(2)}/mi</span>
                  <span className="total-rate">${load.totalRate?.toFixed(2)}</span>
                </div>

                {load.fitReason && (
                  <div className="fit-reason">{load.fitReason}</div>
                )}

                <div className="load-meta">
                  {load.broker && <span className="broker-tag">🏢 {load.broker}</span>}
                  {load.equipment && <span className="equipment-tag">🚛 {load.equipment}</span>}
                </div>

                <div className="load-footer">
                  <small>{new Date(load.extractedAt).toLocaleDateString()}</small>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Broker Relationships */}
      <section className="broker-relationships-section">
        <h2>📊 Broker Relationships - Direct Contract Candidates</h2>
        {allBrokers.length === 0 ? (
          <p className="no-data">No broker data yet. System is collecting relationships...</p>
        ) : (
          <div className="broker-table-container">
            <table className="broker-table">
              <thead>
                <tr>
                  <th>Broker</th>
                  <th>Relationship</th>
                  <th>Total Loads</th>
                  <th>This Month</th>
                  <th>Avg Rate/Mi</th>
                  <th>Top Lanes</th>
                  <th>Contact Freq</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {allBrokers.map(broker => (
                  <tr 
                    key={broker.id} 
                    className={broker.relationshipScore >= 80 ? 'hot-broker' : ''}
                  >
                    <td>
                      <div className="broker-cell">
                        <strong>{broker.broker}</strong>
                        {broker.brokerEmail && (
                          <small className="email">{broker.brokerEmail}</small>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="relationship-cell">
                        <span className="relationship-badge">
                          {getRelationshipLevel(broker.relationshipScore)}
                        </span>
                        <small className="score">{broker.relationshipScore}/100</small>
                      </div>
                    </td>
                    <td><strong>{broker.totalLoads}</strong></td>
                    <td>{broker.loadsThisMonth}</td>
                    <td>
                      <div className="rate-cell">
                        <strong>${broker.avgRatePerMile?.toFixed(2)}</strong>
                        {broker.lowestRate && broker.highestRate && (
                          <small className="range">
                            ${broker.lowestRate.toFixed(2)} - ${broker.highestRate.toFixed(2)}
                          </small>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="lanes-cell">
                        {broker.topLanes?.slice(0, 2).map((lane: any, i: number) => (
                          <div key={i} className="lane-item">
                            {lane.lane} ({lane.count}x)
                          </div>
                        ))}
                      </div>
                    </td>
                    <td>
                      {broker.avgDaysBetween 
                        ? `Every ${Math.round(broker.avgDaysBetween)} days`
                        : 'N/A'
                      }
                    </td>
                    <td>
                      <button 
                        className="view-loads-btn"
                        onClick={() => handleBrokerClick(broker.broker)}
                      >
                        View Loads →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Broker Detail Modal */}
      {selectedBroker && (
        <div className="modal-overlay" onClick={() => setSelectedBroker(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📦 Loads from {selectedBroker}</h2>
              <button className="close-btn" onClick={() => setSelectedBroker(null)}>✕</button>
            </div>
            <div className="modal-content">
              {brokerLoads.length === 0 ? (
                <p>No loads found from this broker.</p>
              ) : (
                <div className="loads-list">
                  {brokerLoads.map(load => (
                    <div key={load.id} className={`load-item ${getPriorityClass(load.priorityScore)}`}>
                      <div className="load-summary">
                        <span className="route">
                          {load.origin} → {load.destination}
                        </span>
                        <span className="rate">${load.ratePerMile?.toFixed(2)}/mi</span>
                        <span className="score-badge">{load.priorityScore}</span>
                      </div>
                      <div className="load-details">
                        <span>{load.equipment}</span>
                        <span>{load.distance} mi</span>
                        <span>${load.totalRate?.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}