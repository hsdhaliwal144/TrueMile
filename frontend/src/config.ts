// API configuration based on environment
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const apiEndpoints = {
  // Fleet endpoints
  fleet: `${API_URL}/api/fleet`,
  rigbyChat: `${API_URL}/api/rigby/chat`,
  
  // Broker Intelligence endpoints
  brokerIntelligence: {
    stats: `${API_URL}/api/broker-intelligence/stats`,
    priorityLoads: (minScore: number = 70) => `${API_URL}/api/broker-intelligence/priority-loads?minScore=${minScore}`,
    brokers: `${API_URL}/api/broker-intelligence/brokers`,
    brokerLoads: (broker: string) => `${API_URL}/api/broker-intelligence/brokers/${encodeURIComponent(broker)}/loads`,
  },
  
  // Broker Outreach endpoints
brokerOutreach: {
  generate: `${API_URL}/api/outreach/generate`,
  drafts: (status: string = '') => `${API_URL}/api/outreach/drafts${status ? `?status=${status}` : ''}`,
  stats: `${API_URL}/api/outreach/stats`,
  generateBatch: `${API_URL}/api/outreach/generate-batch`,
  updateDraft: (id: number) => `${API_URL}/api/outreach/drafts/${id}`,
  sendDraft: (id: number) => `${API_URL}/api/outreach/drafts/${id}/send`,
  deleteDraft: (id: number) => `${API_URL}/api/outreach/drafts/${id}`,
  base: `${API_URL}/api/outreach`
},

  // Profit Engine endpoints
  profitEngine: {
    dashboard: (period: string, factoringRate: number = 2.2, startDate?: string, endDate?: string) => {
      let url = `${API_URL}/api/profit-engine/dashboard?period=${period}&factoringRate=${factoringRate}`;
      if (startDate && endDate) {
        url += `&startDate=${startDate}&endDate=${endDate}`;
      }
      return url;
    },
    uploadRatecons: `${API_URL}/api/profit-engine/upload-ratecons`,
    uploadFuel: `${API_URL}/api/profit-engine/upload-fuel`,
    uploadCC: `${API_URL}/api/profit-engine/upload-cc`,
    uploadBank: `${API_URL}/api/profit-engine/upload-bank`,
    mapCard: `${API_URL}/api/profit-engine/map-card`,
    deleteLoad: (id: string | number) => `${API_URL}/api/profit-engine/loads/${id}`,
    updateLoad: (id: string | number) => `${API_URL}/api/profit-engine/loads/${id}`,
  },

  // Load Optimizer endpoints
  optimizer: {
    screenshot: `${API_URL}/api/optimizer/screenshot`,
    candidates: (params?: { status?: string; minScore?: number; driverId?: number; limit?: number }) => {
      const searchParams = new URLSearchParams();
      if (params?.status) searchParams.append('status', params.status);
      if (params?.minScore) searchParams.append('minScore', params.minScore.toString());
      if (params?.driverId) searchParams.append('driverId', params.driverId.toString());
      if (params?.limit) searchParams.append('limit', params.limit.toString());
      const query = searchParams.toString();
      return `${API_URL}/api/optimizer/candidates${query ? `?${query}` : ''}`;
    },
    lanes: (params?: { driverId?: number; scope?: string; limit?: number }) => {
      const searchParams = new URLSearchParams();
      if (params?.driverId) searchParams.append('driverId', params.driverId.toString());
      if (params?.scope) searchParams.append('scope', params.scope);
      if (params?.limit) searchParams.append('limit', params.limit.toString());
      const query = searchParams.toString();
      return `${API_URL}/api/optimizer/lanes${query ? `?${query}` : ''}`;
    },
    deleteCandidate: (id: number) => `${API_URL}/api/optimizer/candidates/${id}`,
  },

  // Outreach endpoints (for Load Optimizer)
  outreach: {
    draft: `${API_URL}/api/outreach/draft`,
    send: `${API_URL}/api/outreach/send`,
  },
} as const;