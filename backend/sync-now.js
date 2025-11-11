const { GmailSyncService } = require('./dist/services/gmail/sync.service.js');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function sync() {
  const account = await prisma.emailAccount.findFirst({
    where: { provider: 'GMAIL', isActive: true }
  });
  
  if (!account) {
    console.log('No Gmail account found');
    return;
  }
  
  console.log('Starting sync...');
  await GmailSyncService.syncAccount(account.id);
  console.log('Sync complete!');
  process.exit(0);
}

sync();
