// src/services/outlook/oauth.service.ts

import { ConfidentialClientApplication } from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';
import { prisma } from '../db';
import { encryptToken, decryptToken } from '../../utils/encryption';

const msalConfig = {
  auth: {
    clientId: process.env.MICROSOFT_CLIENT_ID!,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
    authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || 'common'}`
  }
};

const SCOPES = ['Mail.Read', 'offline_access', 'User.Read'];

export class OutlookOAuthService {
  private static msalClient = new ConfidentialClientApplication(msalConfig);

  /**
   * Generate authorization URL for user consent
   */
  static getAuthUrl(userId: string): string {
    const authCodeUrlParameters = {
      scopes: SCOPES,
      redirectUri: process.env.MICROSOFT_REDIRECT_URI!,
      state: JSON.stringify({ userId, provider: 'outlook' }),
      prompt: 'consent',
      responseMode: 'query' as any
    };

    return this.msalClient.getAuthCodeUrl(authCodeUrlParameters);
  }

  /**
   * Handle OAuth callback and store tokens
   */
  static async handleCallback(code: string, userId: string): Promise<void> {
    try {
      const tokenRequest = {
        code,
        scopes: SCOPES,
        redirectUri: process.env.MICROSOFT_REDIRECT_URI!
      };

      const response = await this.msalClient.acquireTokenByCode(tokenRequest);

      if (!response.accessToken) {
        throw new Error('No access token received from Microsoft');
      }

      // Verify we got a refresh token
      if (!response.refreshToken) {
        console.error('WARNING: No refresh token received. offline_access scope may not be properly configured.');
      }

      console.log('✓ Access token received (length:', response.accessToken.length, ')');
      console.log('✓ Refresh token received:', !!response.refreshToken);
      console.log('✓ Token expires at:', response.expiresOn);

      // Test the token immediately
      const graphClient = Client.init({
        authProvider: (done) => {
          done(null, response.accessToken);
        }
      });

      const user = await graphClient.api('/me').select('mail,userPrincipalName,displayName').get();

      const userEmail = user.mail || user.userPrincipalName;
      if (!userEmail) {
        throw new Error('Could not retrieve user email');
      }

      console.log('✓ Successfully authenticated user:', userEmail);

      const tokenExpiry = response.expiresOn || new Date(Date.now() + 3600 * 1000);

      // Create or get user by email (email is unique, id is auto-generated)
      const dbUser = await prisma.user.upsert({
        where: { email: userEmail },
        create: {
          email: userEmail,
          name: user.displayName || null
        },
        update: {
          name: user.displayName || null
        }
      });

      await prisma.emailAccount.upsert({
        where: {
          userId_email_provider: {
            userId: dbUser.id,
            email: userEmail,
            provider: 'OUTLOOK'
          }
        },
        create: {
          userId: dbUser.id,
          provider: 'OUTLOOK',
          email: userEmail,
          accessToken: encryptToken(response.accessToken),
          refreshToken: response.refreshToken ? encryptToken(response.refreshToken) : null,
          tokenExpiry,
          isActive: true
        },
        update: {
          accessToken: encryptToken(response.accessToken),
          refreshToken: response.refreshToken ? encryptToken(response.refreshToken) : null,
          tokenExpiry,
          isActive: true,
          updatedAt: new Date()
        }
      });

      console.log('✓ Tokens stored in database');
    } catch (error) {
      console.error('Outlook OAuth callback error:', error);
      throw new Error('Failed to complete Outlook authentication');
    }
  }

  /**
   * Get valid Graph client for an email account
   */
  static async getGraphClient(emailAccountId: string): Promise<Client> {
    const account = await prisma.emailAccount.findUnique({
      where: { id: emailAccountId }
    });

    if (!account || account.provider !== 'OUTLOOK') {
      throw new Error('Outlook account not found');
    }

    console.log('=== Token Status for', account.email, '===');
    console.log('Token expiry:', account.tokenExpiry);
    console.log('Current time:', new Date());
    console.log('Token expired?', this.isTokenExpired(account.tokenExpiry));
    console.log('Has refresh token?', !!account.refreshToken);

    // Decrypt and validate token
    let accessToken: string;
    try {
      accessToken = decryptToken(account.accessToken);
      console.log('✓ Token decrypted (length:', accessToken.length, ')');
    } catch (error) {
      console.error('✗ Failed to decrypt access token:', error);
      throw new Error('Token decryption failed - account may be corrupted');
    }

    // Test token validity before use
    const tokenValid = await this.testToken(accessToken);
    
    if (!tokenValid) {
      console.log('Token test failed, attempting refresh...');
      
      if (!account.refreshToken) {
        console.error('✗ No refresh token available');
        await prisma.emailAccount.update({
          where: { id: emailAccountId },
          data: { isActive: false }
        });
        throw new Error('Token invalid and no refresh token available - user must re-authenticate');
      }
      
      await this.refreshAccessToken(emailAccountId);
      return this.getGraphClient(emailAccountId); // Retry with new token
    }

    // Check if token is expired or expiring soon
    if (this.isTokenExpired(account.tokenExpiry)) {
      console.log('Token expired or expiring soon, refreshing...');
      await this.refreshAccessToken(emailAccountId);
      return this.getGraphClient(emailAccountId);
    }

    const client = Client.init({
      authProvider: (done) => {
        done(null, accessToken);
      }
    });

    return client;
  }

  /**
   * Test if a token is valid by making a lightweight API call
   * Also verifies the token has Mail.Read permission
   */
  private static async testToken(accessToken: string): Promise<boolean> {
    try {
      // First test basic token validity
      const meResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!meResponse.ok) {
        const errorText = await meResponse.text();
        console.log('✗ Token test failed (basic):', meResponse.status, errorText);
        return false;
      }

      console.log('✓ Token is valid (basic profile access works)');

      // Test if token has Mail.Read permission by trying to access messages
      const mailResponse = await fetch('https://graph.microsoft.com/v1.0/me/messages?$top=1', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!mailResponse.ok) {
        const errorText = await mailResponse.text();
        console.log('✗ Token LACKS Mail.Read permission:', mailResponse.status);
        console.log('   Error:', errorText);
        console.log('   ⚠️  User needs to re-authenticate with Mail.Read scope');
        return false;
      }

      console.log('✓ Token has Mail.Read permission');
      return true;
    } catch (error) {
      console.error('✗ Token test error:', error);
      return false;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  static async refreshAccessToken(emailAccountId: string): Promise<void> {
    const account = await prisma.emailAccount.findUnique({
      where: { id: emailAccountId }
    });

    if (!account || !account.refreshToken) {
      throw new Error('Cannot refresh token: account or refresh token not found');
    }

    try {
      const refreshToken = decryptToken(account.refreshToken);
      console.log('Attempting token refresh with refresh token (length:', refreshToken.length, ')');

      const tokenRequest = {
        refreshToken,
        scopes: SCOPES
      };

      const response = await this.msalClient.acquireTokenByRefreshToken(tokenRequest);

      if (!response.accessToken) {
        throw new Error('No access token returned from refresh');
      }

      console.log('✓ Token refresh successful');
      console.log('✓ New access token (length:', response.accessToken.length, ')');
      console.log('✓ New refresh token received:', !!response.refreshToken);

      const tokenExpiry = response.expiresOn || new Date(Date.now() + 3600 * 1000);

      await prisma.emailAccount.update({
        where: { id: emailAccountId },
        data: {
          accessToken: encryptToken(response.accessToken),
          // Always update refresh token if we get a new one
          refreshToken: response.refreshToken ? encryptToken(response.refreshToken) : account.refreshToken,
          tokenExpiry,
          updatedAt: new Date()
        }
      });

      console.log('✓ Updated tokens stored in database');
    } catch (error: any) {
      console.error('✗ Token refresh failed:', error);
      console.error('Error details:', {
        message: error.message,
        errorCode: error.errorCode,
        errorMessage: error.errorMessage
      });

      // Mark account as inactive so user knows they need to re-authenticate
      await prisma.emailAccount.update({
        where: { id: emailAccountId },
        data: { isActive: false }
      });

      throw new Error('Failed to refresh Outlook token - user needs to re-authenticate');
    }
  }

  /**
   * Check if token is expired or about to expire (within 5 minutes)
   */
  private static isTokenExpired(expiry: Date | null): boolean {
    if (!expiry) return true;
    const bufferMs = 5 * 60 * 1000; // 5 minutes
    return expiry.getTime() - Date.now() < bufferMs;
  }

  /**
   * Revoke access and delete account
   */
  static async revokeAccess(emailAccountId: string): Promise<void> {
    const account = await prisma.emailAccount.findUnique({
      where: { id: emailAccountId }
    });

    if (!account) return;

    await prisma.emailAccount.delete({
      where: { id: emailAccountId }
    });
  }

  /**
   * Debug method to check account status
   */
  static async debugAccountStatus(emailAccountId: string): Promise<void> {
    const account = await prisma.emailAccount.findUnique({
      where: { id: emailAccountId }
    });

    if (!account) {
      console.log('Account not found');
      return;
    }

    console.log('=== Account Debug Info ===');
    console.log('Email:', account.email);
    console.log('Provider:', account.provider);
    console.log('Is Active:', account.isActive);
    console.log('Token Expiry:', account.tokenExpiry);
    console.log('Has Access Token:', !!account.accessToken);
    console.log('Access Token Length (encrypted):', account.accessToken?.length);
    console.log('Has Refresh Token:', !!account.refreshToken);
    console.log('Refresh Token Length (encrypted):', account.refreshToken?.length);
    console.log('Last Sync:', account.lastSyncAt);
    console.log('Created:', account.createdAt);
    console.log('Updated:', account.updatedAt);

    if (account.accessToken) {
      try {
        const decrypted = decryptToken(account.accessToken);
        console.log('✓ Access token decrypts successfully (length:', decrypted.length, ')');
        
        const isValid = await this.testToken(decrypted);
        console.log('Token validity test:', isValid ? '✓ VALID' : '✗ INVALID');
      } catch (error) {
        console.log('✗ Failed to decrypt or test token:', error);
      }
    }
  }
}