const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearDrafts() {
  const result = await prisma.outreachDraft.deleteMany({});
  console.log(`✅ Deleted ${result.count} drafts`);
  await prisma.$disconnect();
}

clearDrafts();
