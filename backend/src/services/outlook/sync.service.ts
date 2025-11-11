// src/services/outlook/sync.service.ts

import { Client, PageCollection } from '@microsoft/microsoft-graph-client';
import { Message as GraphMessage } from '@microsoft/microsoft-graph-types';
import { OutlookOAuthService } from './oauth.service';
import { BrokerIdentifierService } from '../email/broker-identifier.service';
import { prisma } from '../db';
import { Prisma } from '@prisma/client';

export class OutlookSyncService {
  /**
   * Sync messages for an Outlook account
   */
  static async syncMessages(emailAccountId: string): Promise<{
    messagesFound: number;
    messagesSynced: number;
  }> {
    const account = await prisma.emailAccount.findUnique({
      where: { id: emailAccountId }
    });

    if (!account || account.provider !== 'OUTLOOK') {
      throw new Error('Outlook account not found');
    }

    // DEBUG: Check account status before syncing
    console.log('\n=== DEBUG: Starting sync for account ===');
    await OutlookOAuthService.debugAccountStatus(emailAccountId);
    console.log('=====================================\n');

    const syncJob = await prisma.syncJob.create({
      data: {
        emailAccountId,
        provider: 'OUTLOOK',
        status: 'running'
      }
    });

    try {
      const graphClient = await OutlookOAuthService.getGraphClient(emailAccountId);

      let messagesFound = 0;
      let messagesSynced = 0;

      const lastSync = account.lastSyncAt;
      const filter = this.buildFilterQuery(lastSync);

      let request = graphClient
        .api('/me/messages')
        .select([
          'id',
          'conversationId',
          'subject',
          'bodyPreview',
          'body',
          'from',
          'toRecipients',
          'ccRecipients',
          'receivedDateTime',
          'categories'
        ].join(','))
        .top(500)
        .orderby('receivedDateTime DESC');

      if (filter) {
        request = request.filter(filter);
      }

      let messages: GraphMessage[] = [];
      let response: PageCollection = await request.get();

      messages = messages.concat(response.value);
      messagesFound += response.value.length;

      while (response['@odata.nextLink']) {
        response = await graphClient.api(response['@odata.nextLink']).get();
        messages = messages.concat(response.value);
        messagesFound += response.value.length;
      }

      console.log(`Found ${messagesFound} messages for account ${account.email}`);

      for (const message of messages) {
        try {
          await this.saveMessage(emailAccountId, message);
          messagesSynced++;
        } catch (error) {
          console.error(`Error saving message ${message.id}:`, error);
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
      console.error('Outlook sync error:', error);

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
   * Build Microsoft Graph filter query based on last sync
   */
  private static buildFilterQuery(lastSync: Date | null): string | null {
    if (!lastSync) {
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      return `receivedDateTime ge ${twoWeeksAgo.toISOString()}`;
    }

    return `receivedDateTime ge ${lastSync.toISOString()}`;
  }

  /**
   * Save Outlook message to database
   */
  private static async saveMessage(
    emailAccountId: string,
    message: GraphMessage
  ): Promise<void> {
    if (!message.id) return;

    const from = message.from?.emailAddress?.address || '';
    const fromName = message.from?.emailAddress?.name || null;

    const toEmails = (message.toRecipients || [])
      .map(r => r.emailAddress?.address)
      .filter((e): e is string => !!e);

    const ccEmails = (message.ccRecipients || [])
      .map(r => r.emailAddress?.address)
      .filter((e): e is string => !!e);

    const receivedAt = message.receivedDateTime 
      ? new Date(message.receivedDateTime)
      : new Date();

    const categories = message.categories || [];

    const body = message.body?.content || null;

    // ⭐ BROKER IDENTIFICATION ⭐
    const brokerAnalysis = BrokerIdentifierService.isLikelyBrokerEmail(
      from,
      message.subject || '',
      body || message.bodyPreview || ''
    );

    if (brokerAnalysis.isBroker) {
      console.log(`📧 Broker email: ${brokerAnalysis.brokerName || 'Unknown'} (${brokerAnalysis.confidence}) from ${from}`);
    }
    // ⭐ END BROKER IDENTIFICATION ⭐

    const data: Prisma.MessageCreateInput = {
      emailAccount: {
        connect: { id: emailAccountId }
      },
      externalId: message.id,
      threadId: message.conversationId || null,
      from,
      fromName,
      to: toEmails,
      cc: ccEmails,
      subject: message.subject || '',
      snippet: message.bodyPreview || null,
      body,
      receivedAt,
      labels: [],
      categories,
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
        subject: message.subject || '',
        snippet: message.bodyPreview || null,
        body,
        categories,
        // ⭐ ADD BROKER FIELDS TO UPDATE ⭐
        isBroker: brokerAnalysis.isBroker,
        brokerName: brokerAnalysis.brokerName,
        updatedAt: new Date()
      }
    });
  }
}