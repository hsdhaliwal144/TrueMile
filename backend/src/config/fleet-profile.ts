// Fleet Profile - Royal Carriers Inc.
export const fleetProfile = {
  company: {
    name: "Royal Carriers Inc.",
    mc_number: "MC-48737",
    dot_number: "DOT-3048811",
  },
  
  fleet: {
    trucks: {
      count: 3,
      make: "Freightliner",
      model: "Cascadia 126",
      year: "2023", // Update as needed
    },
    trailers: [
      {
        count: 1,
        type: "53ft Reefer",
        make: "Great Dane",
        unit: "Thermo King C600",
        description: "Temperature controlled, -20°F to 70°F capable"
      },
      {
        count: 1,
        type: "53ft Reefer",
        make: "Great Dane", 
        unit: "Thermo King S700",
        description: "Temperature controlled, -20°F to 70°F capable"
      },
      {
        count: 1,
        type: "53ft Dry Van",
        make: "Utility",
        description: "Standard dry freight"
      }
    ],
    capacity: "2 reefer units, 1 dry van available"
  },

  insurance: {
    liability: "$1,000,000 per occurrence",
    aggregate: "$2,000,000 general aggregate",
    cargo: "$2,000,000 cargo insurance",
  },

  coverage: {
    primary_states: ["TX", "OK", "LA", "AR", "NM", "KS", "MO", "MS", "TN", "AL", "GA", "FL", "SC", "NC", "VA", "WV", "KY", "IN", "IL", "WI", "MI", "OH", "PA", "MD", "DE", "CT", "RI", "VT", "NH", "ME", "IA", "MN", "ND", "SD", "NE", "CO", "WY", "MT", "ID", "UT", "AZ", "NV", "WA", "AK", "HI"],
    excluded_states: ["CA", "OR", "NJ", "NY", "MA"],
    description: "Nationwide coverage - all 48 states except CA, OR, NJ, NY, MA"
  },

  capabilities: {
    reefer: true,
    dry_van: true,
    temperature_controlled: true,
    team_drivers: false, // Update if you have teams
    hazmat: false, // Update if you have HAZMAT certified
    expedited: true,
    dedicated_lanes: true,
  },

  competitive_advantages: [
    "Modern Cascadia fleet with excellent fuel efficiency",
    "Dual reefer capability with Thermo King units",
    "Reliable temperature-controlled transport",
    "Nationwide coverage - will run anywhere except CA, OR, NJ, NY, MA",
    "Small carrier flexibility with big carrier reliability"
  ],

  target_rate: {
    minimum: 2.00, // per mile
    preferred: 2.50,
    currency: "USD"
  },

  contact: {
  email: "royalcarrier3@gmail.com",
  phone: "469-394-7061",
  hours: "24/7 dispatch available",
  name: "Harpreet Dhaliwal",
  title: "Operations Manager"
}
};

export default fleetProfile;
