// src/config/company-preferences.ts

export const COMPANY_PREFERENCES = {
  // Minimum acceptable rate per mile
  minRatePerMile: 2.00,

  // States you operate in or prefer
  preferredStates: ['TX', 'OK', 'LA', 'AR', 'NM'],

  // Equipment types you have
  preferredEquipment: ['Dry Van', 'Reefer'],

  // Maximum distance you want to haul
  maxDistance: 500,

  // Your home base
  homeBase: 'Dallas, TX'
};

// Priority Score Guide:
// 80-100: EXCELLENT - Take immediately, perfect fit
// 60-79:  GOOD - Consider carefully, decent opportunity
// 40-59:  MARGINAL - Last resort, not ideal
// 0-39:   PASS - Not worth pursuing

// Relationship Score Guide:
// 80-100: HOT - Contact for direct contract, high volume + good rates
// 60-79:  WARM - Build relationship, consistent partner
// 0-59:   COLD - Monitor only, occasional sender
