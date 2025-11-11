/*Create test.js in your project root:*/
const { BrokerIdentifierService } = require('./src/services/email/broker-identifier.service');

const test = BrokerIdentifierService.isLikelyBrokerEmail(
  'dispatch@hubgroup.com',
  'Load #12345',
  'Rate confirmation'
);

console.log(test);
// Should show: { isBroker: true, brokerName: 'Hub Group', confidence: 'high' }