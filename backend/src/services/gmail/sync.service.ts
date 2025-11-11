// src/services/gmail/sync.service.ts

import { google, gmail_v1 } from 'googleapis';
import { GmailOAuthService } from './oauth.service';
import { BrokerIdentifierService } from '../email/broker-identifier.service';
import LoadExtractorService from '../email/load-extractor.service';
import { COMPANY_PREFERENCES } from '../../config/company-preferences';
import { prisma } from '../db';
import { Prisma } from '@prisma/client';

export class GmailSyncService {
  private static loadExtractor = new LoadExtractorService(COMPANY_PREFERENCES);

  /**
   * Sync messages for a Gmail account
   */
  static async syncMessages(emailAccountId: string): Promise<{
    messagesFound: number;
    messagesSynced: number;
  }> {
    const account = await prisma.emailAccount.findUnique({
      where: { id: emailAccountId }
    });

    if (!account || account.provider !== 'GMAIL') {
      throw new Error('Gmail account not found');
    }

    const syncJob = await prisma.syncJob.create({
      data: {
        emailAccountId,
        provider: 'GMAIL',
        status: 'running'
      }
    });

    try {
      const oauth2Client = await GmailOAuthService.getAuthClient(emailAccountId);
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      let messagesFound = 0;
      let messagesSynced = 0;

      const lastSync = account.lastSyncAt;
      const query = this.buildSearchQuery(lastSync);

      const listResponse = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 500
      });

      const messageIds = listResponse.data.messages || [];
      messagesFound = messageIds.length;

      console.log(`Found ${messagesFound} messages for account ${account.email}`);

      for (const messageRef of messageIds) {
        if (!messageRef.id) continue;

        try {
          const message = await gmail.users.messages.get({
            userId: 'me',
            id: messageRef.id,
            format: 'full'
          });

          await this.saveMessage(emailAccountId, message.data);
          messagesSynced++;
        } catch (error) {
          console.error(`Error fetching message ${messageRef.id}:`, error);
        }
      }

      await prisma.emailAccount.update({
        where: { id: emailAccountId },
        data: {
          lastSyncAt: new Date()
        }
      });

      await prisma.syncJob.update({
        where: { id: syncJob.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          messagesFound,
          messagesSynced
        }
      });

      return { messagesFound, messagesSynced };
    } catch (error) {
      console.error('Gmail sync error:', error);

      await prisma.syncJob.update({
        where: { id: syncJob.id },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      });

      throw error;
    }
  }

  /**
   * Build Gmail search query based on last sync
   */
  private static buildSearchQuery(lastSync: Date | null): string {
    if (!lastSync) {
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      const dateStr = twoWeeksAgo.toISOString().split('T')[0].replace(/-/g, '/');
      return `after:${dateStr}`;
    }

    const dateStr = lastSync.toISOString().split('T')[0].replace(/-/g, '/');
    return `after:${dateStr}`;
  }

  /**
   * Save Gmail message to database
   */
  private static async saveMessage(
    emailAccountId: string,
    message: gmail_v1.Schema$Message
  ): Promise<void> {
    if (!message.id) return;

    const headers = message.payload?.headers || [];
    const getHeader = (name: string) => 
      headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

    const from = getHeader('from');
    const to = getHeader('to');
    const cc = getHeader('cc');
    const subject = getHeader('subject');
    const dateStr = getHeader('date');

    const fromEmail = this.extractEmail(from);
    const fromName = this.extractName(from);
    const toEmails = this.parseEmailList(to);
    const ccEmails = this.parseEmailList(cc);

    const receivedAt = dateStr ? new Date(dateStr) : new Date(parseInt(message.internalDate || '0'));

    const labels = message.labelIds || [];

    const body = this.extractBody(message.payload);

    // ⭐ BROKER IDENTIFICATION ⭐
    const brokerAnalysis = BrokerIdentifierService.isLikelyBrokerEmail(
      fromEmail,
      subject,
      body || message.snippet || ''
    );

    if (brokerAnalysis.isBroker) {
      console.log(`📧 Broker email: ${brokerAnalysis.brokerName || 'Unknown'} (${brokerAnalysis.confidence}) from ${fromEmail}`);
    }
    // ⭐ END BROKER IDENTIFICATION ⭐

    const data: Prisma.MessageCreateInput = {
      emailAccount: {
        connect: { id: emailAccountId }
      },
      externalId: message.id,
      threadId: message.threadId || null,
      from: fromEmail,
      fromName: fromName || null,
      to: toEmails,
      cc: ccEmails,
      subject,
      snippet: message.snippet || null,
      body,
      receivedAt,
      labels,
      categories: [],
      syncStatus: 'SYNCED',
      // ⭐ ADD BROKER FIELDS ⭐
      isBroker: brokerAnalysis.isBroker,
      brokerName: brokerAnalysis.brokerName
    };

    await prisma.message.upsert({
      where: {
        emailAccountId_externalId: {
          emailAccountId,
          externalId: message.id
        }
      },
      create: data,
      update: {
        subject,
        snippet: message.snippet || null,
        body,
        labels,
        // ⭐ ADD BROKER FIELDS TO UPDATE ⭐
        isBroker: brokerAnalysis.isBroker,
        brokerName: brokerAnalysis.brokerName,
        updatedAt: new Date()
      }
    });

    // ⭐ LOAD EXTRACTION ⭐
    const savedMessage = await prisma.message.findUnique({
      where: {
        emailAccountId_externalId: {
          emailAccountId,
          externalId: message.id
        }
      }
    });
    
    if (savedMessage) {
      await this.loadExtractor.extractFromMessage(savedMessage);
    }
    // ⭐ END LOAD EXTRACTION ⭐
  }

  /**
   * Extract email body from Gmail message payload
   */
  private static extractBody(payload?: gmail_v1.Schema$MessagePart): string | null {
    if (!payload) return null;

    if (payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64').toString('utf-8');
    }

    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
      }

      for (const part of payload.parts) {
        if (part.mimeType === 'text/html' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
      }

      for (const part of payload.parts) {
        const body = this.extractBody(part);
        if (body) return body;
      }
    }

    return null;
  }

  /**
   * Extract email address from "Name <email@example.com>" format
   */
  private static extractEmail(emailStr: string): string {
    const match = emailStr.match(/<(.+?)>/);
    return match ? match[1] : emailStr.trim();
  }

  /**
   * Extract name from "Name <email@example.com>" format
   */
  private static extractName(emailStr: string): string {
    const match = emailStr.match(/^(.+?)\s*</);
    return match ? match[1].trim().replace(/^["']|["']$/g, '') : '';
  }

  /**
   * Parse comma-separated email list
   */
  private static parseEmailList(emailStr: string): string[] {
    if (!emailStr) return [];
    return emailStr
      .split(',')
      .map(e => this.extractEmail(e))
      .filter(e => e.length > 0);
  }
}