// src/routes/sync.routes.ts

import { Router, Request, Response } from 'express';
import { GmailSyncService } from '../services/gmail/sync.service';
import { OutlookSyncService } from '../services/outlook/sync.service';
import { prisma } from '../services/db';

const router = Router();

/**
 * POST /api/sync/:accountId
 * Trigger manual sync for an email account
 */
router.post('/:accountId', async (req: Request, res: Response) => {
  try {
    const { accountId } = req.params;

    const account = await prisma.emailAccount.findUnique({
      where: { id: accountId }
    });

    if (!account) {
      return res.status(404).json({ error: 'Email account not found' });
    }

    if (!account.isActive) {
      return res.status(400).json({ 
        error: 'Account is inactive - user needs to re-authenticate' 
      });
    }

    let result;
    if (account.provider === 'GMAIL') {
      result = await GmailSyncService.syncMessages(accountId);
    } else if (account.provider === 'OUTLOOK') {
      result = await OutlookSyncService.syncMessages(accountId);
    } else {
      return res.status(400).json({ error: 'Invalid provider' });
    }

    res.json({
      success: true,
      accountId,
      provider: account.provider,
      messagesFound: result.messagesFound,
      messagesSynced: result.messagesSynced
    });
  } catch (error) {
    console.error('Manual sync error:', error);
    res.status(500).json({
      error: 'Sync failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/sync/status/:accountId
 * Get sync status and last sync info
 */
router.get('/status/:accountId', async (req: Request, res: Response) => {
  try {
    const { accountId } = req.params;

    const account = await prisma.emailAccount.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        email: true,
        provider: true,
        isActive: true,
        lastSyncAt: true,
        createdAt: true,
        _count: {
          select: { messages: true }
        }
      }
    });

    if (!account) {
      return res.status(404).json({ error: 'Email account not found' });
    }

    const latestSync = await prisma.syncJob.findFirst({
      where: { emailAccountId: accountId },
      orderBy: { startedAt: 'desc' }
    });

    res.json({
      account: {
        id: account.id,
        email: account.email,
        provider: account.provider,
        isActive: account.isActive,
        lastSyncAt: account.lastSyncAt,
        totalMessages: account._count.messages,
        connectedAt: account.createdAt
      },
      latestSync: latestSync ? {
        status: latestSync.status,
        startedAt: latestSync.startedAt,
        completedAt: latestSync.completedAt,
        messagesFound: latestSync.messagesFound,
        messagesSynced: latestSync.messagesSynced,
        errorMessage: latestSync.errorMessage
      } : null
    });
  } catch (error) {
    console.error('Get sync status error:', error);
    res.status(500).json({
      error: 'Failed to get sync status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/sync/jobs/:accountId
 * Get sync job history for an account
 */
router.get('/jobs/:accountId', async (req: Request, res: Response) => {
  try {
    const { accountId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;

    const jobs = await prisma.syncJob.findMany({
      where: { emailAccountId: accountId },
      orderBy: { startedAt: 'desc' },
      take: limit
    });

    res.json({
      accountId,
      jobs: jobs.map(job => ({
        id: job.id,
        status: job.status,
        provider: job.provider,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        messagesFound: job.messagesFound,
        messagesSynced: job.messagesSynced,
        errorMessage: job.errorMessage
      }))
    });
  } catch (error) {
    console.error('Get sync jobs error:', error);
    res.status(500).json({
      error: 'Failed to get sync jobs',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;