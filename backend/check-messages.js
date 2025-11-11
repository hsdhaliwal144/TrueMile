// check-messages.js
// Run with: node check-messages.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkMessages() {
  try {
    console.log('🔍 Checking database state...\n');

    // Check accounts
    const accounts = await prisma.emailAccount.findMany({
      select: {
        id: true,
        email: true,
        provider: true,
        isActive: true,
        lastSyncAt: true,
        _count: {
          select: {
            messages: true
          }
        }
      }
    });

    console.log(`📧 Email Accounts: ${accounts.length}`);
    accounts.forEach(account => {
      console.log(`  • ${account.email} (${account.provider})`);
      console.log(`    Active: ${account.isActive}`);
      console.log(`    Last Sync: ${account.lastSyncAt}`);
      console.log(`    Messages: ${account._count.messages}`);
    });

    // Check messages
    const totalMessages = await prisma.message.count();
    console.log(`\n💬 Total Messages: ${totalMessages}`);

    // Check for duplicates
    const messages = await prisma.message.findMany({
      select: {
        externalId: true,
        emailAccountId: true,
        subject: true,
        from: true,
        isBroker: true,
        brokerName: true
      },
      take: 10,
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log('\n📬 Last 10 Messages:');
    messages.forEach((msg, i) => {
      console.log(`  ${i + 1}. ${msg.subject.substring(0, 50)}`);
      console.log(`     From: ${msg.from}`);
      console.log(`     External ID: ${msg.externalId}`);
      console.log(`     Is Broker: ${msg.isBroker}`);
      console.log(`     Broker Name: ${msg.brokerName || 'N/A'}`);
    });

    // Check for actual duplicates
    const duplicates = await prisma.$queryRaw`
      SELECT "emailAccountId", "externalId", COUNT(*) as count
      FROM "Message"
      GROUP BY "emailAccountId", "externalId"
      HAVING COUNT(*) > 1
    `;

    console.log(`\n⚠️  Duplicate Messages: ${duplicates.length}`);
    if (duplicates.length > 0) {
      console.log('PROBLEM: You have duplicate messages!');
      duplicates.slice(0, 5).forEach(dup => {
        console.log(`  • External ID: ${dup.externalId} (${dup.count} copies)`);
      });
    }

    // Check sync jobs
    const recentJobs = await prisma.syncJob.findMany({
      take: 10,
      orderBy: {
        startedAt: 'desc'
      }
    });

    console.log(`\n📊 Recent Sync Jobs: ${recentJobs.length}`);
    recentJobs.forEach(job => {
      console.log(`  • ${job.provider} - ${job.status} - Found: ${job.messagesFound}, Synced: ${job.messagesSynced}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMessages();
