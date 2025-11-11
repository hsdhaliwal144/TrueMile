// test-load-extraction-diagnostic.js
// Enhanced diagnostic to see actual email content and improve extraction
// Run with: node test-load-extraction-diagnostic.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function diagnosticTest() {
  try {
    console.log('🔍 DIAGNOSTIC TEST - Analyzing Email Content...\n');

    // Get broker emails
    const brokerEmails = await prisma.message.findMany({
      where: {
        isBroker: true,
        body: { not: null }
      },
      select: {
        id: true,
        from: true,
        subject: true,
        body: true,
        snippet: true,
        brokerName: true,
      },
      orderBy: {
        receivedAt: 'desc'
      },
      take: 10 // Just analyze 10 for diagnostics
    });

    console.log(`📧 Analyzing ${brokerEmails.length} recent broker emails\n`);
    console.log('=' .repeat(80));

    brokerEmails.forEach((email, i) => {
      console.log(`\n📨 EMAIL ${i + 1}:`);
      console.log(`From: ${email.from}`);
      console.log(`Broker: ${email.brokerName || 'Unknown'}`);
      console.log(`Subject: ${email.subject}`);
      console.log(`\nSnippet: ${email.snippet?.substring(0, 150)}...`);
      console.log(`\nBody Preview (first 500 chars):`);
      console.log('-'.repeat(80));
      console.log(email.body?.substring(0, 500));
      console.log('-'.repeat(80));
      
      // Try to spot patterns
      console.log('\n🔍 Pattern Detection:');
      
      const content = `${email.subject} ${email.body}`;
      
      // Look for dollar signs
      const dollarMatches = content.match(/\$[\d,]+/g);
      if (dollarMatches) {
        console.log(`  💰 Dollar amounts found: ${dollarMatches.join(', ')}`);
      }
      
      // Look for city/state patterns
      const cityStatePattern = /([A-Z][a-z]+),?\s+([A-Z]{2})/g;
      const cityStateMatches = [...content.matchAll(cityStatePattern)];
      if (cityStateMatches.length > 0) {
        console.log(`  🌎 City/State patterns:`);
        cityStateMatches.slice(0, 4).forEach(match => {
          console.log(`     - ${match[1]}, ${match[2]}`);
        });
      }
      
      // Look for numbers that might be miles
      const mileMatches = content.match(/(\d{2,4})\s*(?:miles?|mi)/gi);
      if (mileMatches) {
        console.log(`  📏 Mile references: ${mileMatches.join(', ')}`);
      }
      
      // Look for equipment
      const equipment = ['dry van', 'reefer', 'flatbed', 'step deck', 'van'];
      const foundEquip = equipment.filter(e => content.toLowerCase().includes(e));
      if (foundEquip.length > 0) {
        console.log(`  🚛 Equipment: ${foundEquip.join(', ')}`);
      }
      
      // Look for "to" or arrow patterns
      const toPattern = /\s+to\s+/i;
      const arrowPattern = /→|->|-->/;
      if (toPattern.test(content) || arrowPattern.test(content)) {
        console.log(`  ➡️  Contains "to" or arrow pattern`);
      }
      
      // Look for load numbers
      const loadNumPattern = /(?:load|ref|#)\s*#?\s*([A-Z0-9\-]+)/gi;
      const loadMatches = [...content.matchAll(loadNumPattern)];
      if (loadMatches.length > 0) {
        console.log(`  🔢 Load number patterns:`);
        loadMatches.slice(0, 3).forEach(match => {
          console.log(`     - ${match[0]}`);
        });
      }
      
      console.log('\n' + '='.repeat(80));
    });

    console.log('\n\n💡 RECOMMENDATIONS:');
    console.log('Based on this analysis, we can improve extraction patterns for:');
    console.log('1. Rate extraction - look at how dollar amounts appear');
    console.log('2. Lane extraction - check city/state formatting');
    console.log('3. Miles extraction - see if miles are mentioned');
    console.log('4. Load number patterns - verify format variations');
    
    console.log('\n📝 Next Steps:');
    console.log('1. Review the patterns above');
    console.log('2. Note common formats that aren\'t being caught');
    console.log('3. Update load-extractor.service.ts regex patterns');
    console.log('4. Re-run test-load-extraction.js to verify improvements');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

diagnosticTest();
