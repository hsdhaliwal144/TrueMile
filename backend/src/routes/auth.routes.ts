// src/routes/auth.routes.ts

import { Router, Request, Response } from 'express';
import { GmailOAuthService } from '../services/gmail/oauth.service';
import { OutlookOAuthService } from '../services/outlook/oauth.service';

const router = Router();

// ============ Gmail OAuth ============

/**
 * GET /api/auth/gmail/start
 * Initiate Gmail OAuth flow
 */
router.get('/gmail/start', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string || 'temp-user-id';

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const authUrl = GmailOAuthService.getAuthUrl(userId);
    
    res.json({ 
      success: true,
      authUrl,
      provider: 'gmail'
    });
  } catch (error) {
    console.error('Gmail auth start error:', error);
    res.status(500).json({ 
      error: 'Failed to initiate Gmail authentication',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/auth/gmail/callback
 * Handle Gmail OAuth callback
 */
router.get('/gmail/callback', async (req: Request, res: Response) => {
  try {
    console.log('=== Gmail Callback Received ===');
    console.log('Query params:', req.query);
    
    const code = req.query.code as string;
    const state = req.query.state as string;
    const error = req.query.error as string;

    if (error) {
      console.error('OAuth error from Google:', error);
      return res.redirect(`${process.env.FRONTEND_URL}/settings/integrations?error=${error}`);
    }

    if (!code || !state) {
      console.error('Missing code or state:', { code: !!code, state: !!state });
      return res.status(400).json({ error: 'Missing code or state parameter' });
    }

    console.log('Parsing state:', state);
    const { userId, provider } = JSON.parse(state);
    console.log('Parsed userId:', userId, 'provider:', provider);

    if (provider !== 'gmail') {
      console.error('Invalid provider:', provider);
      return res.status(400).json({ error: 'Invalid provider in state' });
    }

    console.log('Calling GmailOAuthService.handleCallback...');
    await GmailOAuthService.handleCallback(code, userId);
    console.log('✓ Gmail OAuth completed successfully');

    res.redirect(`${process.env.FRONTEND_URL}/settings/integrations?success=gmail`);
  } catch (error) {
    console.error('❌ Gmail callback error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    res.redirect(`${process.env.FRONTEND_URL}/settings/integrations?error=callback_failed`);
  }
});

// ============ Outlook OAuth ============

/**
 * GET /api/auth/outlook/start
 * Initiate Outlook OAuth flow
 */
router.get('/outlook/start', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string || 'temp-user-id';

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const authUrl = await OutlookOAuthService.getAuthUrl(userId);
    
    res.json({ 
      success: true,
      authUrl,
      provider: 'outlook'
    });
  } catch (error) {
    console.error('Outlook auth start error:', error);
    res.status(500).json({ 
      error: 'Failed to initiate Outlook authentication',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/auth/outlook/callback
 * Handle Outlook OAuth callback
 */
router.get('/outlook/callback', async (req: Request, res: Response) => {
  try {
    const code = req.query.code as string;
    const state = req.query.state as string;
    const error = req.query.error as string;
    const errorDescription = req.query.error_description as string;

    if (error) {
      const errorMsg = errorDescription || error;
      return res.redirect(`${process.env.FRONTEND_URL}/settings/integrations?error=${encodeURIComponent(errorMsg)}`);
    }

    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state parameter' });
    }

    const { userId, provider } = JSON.parse(state);

    if (provider !== 'outlook') {
      return res.status(400).json({ error: 'Invalid provider in state' });
    }

    await OutlookOAuthService.handleCallback(code, userId);

    res.redirect(`${process.env.FRONTEND_URL}/settings/integrations?success=outlook`);
  } catch (error) {
    console.error('Outlook callback error:', error);
    console.error('Error details:', error);
    res.redirect(`${process.env.FRONTEND_URL}/settings/integrations?error=callback_failed`);
  }
});

// ============ Account Management ============

/**
 * DELETE /api/auth/:provider/:accountId
 * Revoke OAuth access and delete account
 */
router.delete('/:provider/:accountId', async (req: Request, res: Response) => {
  try {
    const { provider, accountId } = req.params;

    if (provider === 'gmail') {
      await GmailOAuthService.revokeAccess(accountId);
    } else if (provider === 'outlook') {
      await OutlookOAuthService.revokeAccess(accountId);
    } else {
      return res.status(400).json({ error: 'Invalid provider' });
    }

    res.json({ success: true, message: 'Account disconnected' });
  } catch (error) {
    console.error('Revoke access error:', error);
    res.status(500).json({ 
      error: 'Failed to disconnect account',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;