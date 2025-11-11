// scripts/process-existing-messages.ts

import { PrismaClient } from '@prisma/client';
import LoadExtractorService from '../src/services/email/load-extractor.service';
import { COMPANY_PREFERENCES } from '../src/config/company-preferences';

const prisma = new PrismaClient();

async function processExistingMessages() {
  const loadExtractor = new LoadExtractorService(COMPANY_PREFERENCES);

  // Get all messages from the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const messages = await prisma.message.findMany({
    where: {
      receivedAt: {
        gte: thirtyDaysAgo
      }
    },
    orderBy: {
      receivedAt: 'desc'
    }
  });

  console.log(`Processing ${messages.length} existing messages...`);

  for (const message of messages) {
    await loadExtractor.extractFromMessage(message);
  }

  console.log('✅ Done processing existing messages!');
  await prisma.$disconnect();
}

processExistingMessages();