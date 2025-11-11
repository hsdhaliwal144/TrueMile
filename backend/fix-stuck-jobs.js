// fix-stuck-jobs.js
// Run with: node fix-stuck-jobs.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixStuckJobs() {
  try {
    console.log('🔧 Fixing stuck sync jobs...\n');

    // Mark all "running" jobs as failed
    const result = await prisma.syncJob.updateMany({
      where: {
        status: 'running'
      },
      data: {
        status: 'failed',
        completedAt: new Date(),
        errorMessage: 'Job was stuck - marked as failed'
      }
    });

    console.log(`✓ Fixed ${result.count} stuck jobs`);

    // Show current status
    const jobs = await prisma.syncJob.findMany({
      take: 10,
      orderBy: {
        startedAt: 'desc'
      }
    });

    console.log('\n📊 Recent Sync Jobs:');
    jobs.forEach(job => {
      console.log(`  • ${job.provider} - ${job.status} - ${job.messagesFound} found, ${job.messagesSynced} synced`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixStuckJobs();
