// scripts/test-integration.ts

import { prisma } from '../src/services/db';
import { GmailOAuthService } from '../src/services/gmail/oauth.service';
import { OutlookOAuthService } from '../src/services/outlook/oauth.service';
import { encryptToken, decryptToken } from '../src/utils/encryption';

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  success: (msg: string) => console.log(`${COLORS.green}✓${COLORS.reset} ${msg}`),
  error: (msg: string) => console.log(`${COLORS.red}✗${COLORS.reset} ${msg}`),
  info: (msg: string) => console.log(`${COLORS.blue}ℹ${COLORS.reset} ${msg}`),
  warn: (msg: string) => console.log(`${COLORS.yellow}⚠${COLORS.reset} ${msg}`),
  header: (msg: string) => console.log(`\n${COLORS.cyan}${msg}${COLORS.reset}\n`),
};

async function testEncryption() {
  log.header('Testing Encryption');

  try {
    const testToken = 'test-access-token-1234567890';
    const encrypted = encryptToken(testToken);
    const decrypted = decryptToken(encrypted);

    if (decrypted === testToken) {
      log.success('Encryption/Decryption working correctly');
      log.info(`Original: ${testToken}`);
      log.info(`Encrypted: ${encrypted.substring(0, 50)}...`);
      log.info(`Decrypted: ${decrypted}`);
    } else {
      log.error('Encryption/Decryption mismatch!');
      return false;
    }
  } catch (error) {
    log.error(`Encryption test failed: ${error}`);
    return false;
  }

  return true;
}

async function testDatabaseConnection() {
  log.header('Testing Database Connection');

  try {
    await prisma.$connect();
    log.success('Connected to database');

    const userCount = await prisma.user.count();
    const accountCount = await prisma.emailAccount.count();
    const messageCount = await prisma.message.count();

    log.info(`Users: ${userCount}`);
    log.info(`Email Accounts: ${accountCount}`);
    log.info(`Messages: ${messageCount}`);

    return true;
  } catch (error) {
    log.error(`Database connection failed: ${error}`);
    return false;
  }
}

async function testOAuthUrls() {
  log.header('Testing OAuth URL Generation');

  try {
    const testUserId = 'test-user-' + Date.now();

    const gmailUrl = GmailOAuthService.getAuthUrl(testUserId);
    if (gmailUrl.includes('accounts.google.com') && gmailUrl.includes('gmail.readonly')) {
      log.success('Gmail OAuth URL generated');
      log.info(`URL: ${gmailUrl.substring(0, 80)}...`);
    } else {
      log.error('Gmail OAuth URL invalid');
      return false;
    }

    const outlookUrl = await OutlookOAuthService.getAuthUrl(testUserId);
    if (outlookUrl.includes('login.microsoftonline.com') && outlookUrl.includes('Mail.Read')) {
      log.success('Outlook OAuth URL generated');
      log.info(`URL: ${outlookUrl.substring(0, 80)}...`);
    } else {
      log.error('Outlook OAuth URL invalid');
      return false;
    }

    return true;
  } catch (error) {
    log.error(`OAuth URL generation failed: ${error}`);
    return false;
  }
}

async function testAccountQueries() {
  log.header('Testing Database Queries');

  try {
    const accounts = await prisma.emailAccount.findMany({
      take: 5,
      include: {
        _count: {
          select: { messages: true }
        }
      }
    });

    log.success(`Found ${accounts.length} email accounts`);

    for (const account of accounts) {
      log.info(`- ${account.email} (${account.provider}): ${account._count.messages} messages`);
    }

    const recentJobs = await prisma.syncJob.findMany({
      take: 5,
      orderBy: { startedAt: 'desc' }
    });

    log.success(`Found ${recentJobs.length} recent sync jobs`);

    for (const job of recentJobs) {
      const status = job.status === 'completed' ? COLORS.green : COLORS.yellow;
      log.info(`- ${job.provider}: ${status}${job.status}${COLORS.reset} (${job.messagesSynced} messages)`);
    }

    return true;
  } catch (error) {
    log.error(`Database query failed: ${error}`);
    return false;
  }
}

async function displaySystemStatus() {
  log.header('System Status Summary');

  try {
    const stats = {
      users: await prisma.user.count(),
      accounts: await prisma.emailAccount.count(),
      activeAccounts: await prisma.emailAccount.count({ where: { isActive: true } }),
      messages: await prisma.message.count(),
      syncJobs: await prisma.syncJob.count(),
      completedJobs: await prisma.syncJob.count({ where: { status: 'completed' } }),
      failedJobs: await prisma.syncJob.count({ where: { status: 'failed' } }),
    };

    console.log('┌─────────────────────────────────────┐');
    console.log('│         FLEET1.AI STATUS           │');
    console.log('├─────────────────────────────────────┤');
    console.log(`│ Users:              ${String(stats.users).padStart(13)} │`);
    console.log(`│ Email Accounts:     ${String(stats.accounts).padStart(13)} │`);
    console.log(`│ Active Accounts:    ${String(stats.activeAccounts).padStart(13)} │`);
    console.log(`│ Total Messages:     ${String(stats.messages).padStart(13)} │`);
    console.log(`│ Total Sync Jobs:    ${String(stats.syncJobs).padStart(13)} │`);
    console.log(`│ Completed Jobs:     ${String(stats.completedJobs).padStart(13)} │`);
    console.log(`│ Failed Jobs:        ${String(stats.failedJobs).padStart(13)} │`);
    console.log('└─────────────────────────────────────┘');

    return true;
  } catch (error) {
    log.error(`Status display failed: ${error}`);
    return false;
  }
}

async function runAllTests() {
  console.log('\n' + '='.repeat(50));
  console.log('  FLEET1.AI INTEGRATION TEST SUITE');
  console.log('='.repeat(50));

  const tests = [
    { name: 'Encryption', fn: testEncryption },
    { name: 'Database Connection', fn: testDatabaseConnection },
    { name: 'OAuth URLs', fn: testOAuthUrls },
    { name: 'Database Queries', fn: testAccountQueries },
  ];

  const results: { name: string; passed: boolean }[] = [];

  for (const test of tests) {
    try {
      const passed = await test.fn();
      results.push({ name: test.name, passed });
    } catch (error) {
      log.error(`Test "${test.name}" threw an error: ${error}`);
      results.push({ name: test.name, passed: false });
    }
  }

  await displaySystemStatus();

  log.header('Test Results Summary');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  results.forEach(result => {
    if (result.passed) {
      log.success(result.name);
    } else {
      log.error(result.name);
    }
  });

  console.log('\n' + '='.repeat(50));
  if (failed === 0) {
    console.log(`${COLORS.green}ALL TESTS PASSED (${passed}/${results.length})${COLORS.reset}`);
  } else {
    console.log(`${COLORS.yellow}${passed} PASSED, ${failed} FAILED${COLORS.reset}`);
  }
  console.log('='.repeat(50) + '\n');

  if (failed === 0) {
    log.header('✨ Next Steps');
    log.info('1. Connect an email account via OAuth:');
    log.info('   Visit: http://localhost:3000/api/auth/gmail/start?userId=test-user');
    log.info('   Or: http://localhost:3000/api/auth/outlook/start?userId=test-user');
    log.info('');
    log.info('2. Trigger a manual sync:');
    log.info('   POST http://localhost:3000/api/sync/:accountId');
    log.info('');
    log.info('3. Monitor automatic polling (runs every 5 minutes)');
  }

  await prisma.$disconnect();
}

runAllTests().catch(error => {
  log.error(`Fatal error: ${error}`);
  process.exit(1);
});