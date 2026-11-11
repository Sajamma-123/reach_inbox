import { esClient } from '../../config/elasticsearch.js';
import { env } from '../../config/env.js';
import { prisma } from '../../config/database.js';
import { logger } from '../../utils/logger.js';

export interface EmailIndexPayload {
  emailId: string;
  userId: string;
  senderEmail: string;
  subject: string;
  body: string;
  recipientEmail: string;
  status: string;
  scheduledAt: Date;
  createdAt: Date;
}

export const searchService = {
  /**
   * Indexes or updates email document in Elasticsearch
   */
  async indexEmail(doc: EmailIndexPayload): Promise<void> {
    try {
      await esClient.index({
        index: env.ELASTICSEARCH_INDEX,
        id: `${doc.emailId}_${doc.recipientEmail}`,
        document: {
          ...doc,
          scheduledAt: doc.scheduledAt.toISOString(),
          createdAt: doc.createdAt.toISOString(),
        },
      });
      logger.debug(`Indexed email in Elasticsearch: ${doc.emailId}`);
    } catch (error: any) {
      logger.warn(`ES indexing skipped: ${error.message}`);
    }
  },

  /**
   * Search scheduled and sent emails via Elasticsearch, with database fallback
   */
  async searchEmails(userId: string, query: string, limit = 50) {
    if (!query || query.trim() === '') {
      return this.fallbackDatabaseSearch(userId, '', limit);
    }

    try {
      const response = await esClient.search({
        index: env.ELASTICSEARCH_INDEX,
        size: limit,
        query: {
          bool: {
            must: [
              { term: { userId } },
              {
                multi_match: {
                  query,
                  fields: ['subject^3', 'recipientEmail^2', 'body', 'status'],
                  fuzziness: 'AUTO',
                },
              },
            ],
          },
        },
      });

      const hits = response.hits.hits.map((hit) => hit._source as EmailIndexPayload);
      if (hits.length > 0) {
        return hits;
      }
      // If ES returned 0 hits, cross-check database
      return this.fallbackDatabaseSearch(userId, query, limit);
    } catch (error: any) {
      logger.warn(`ES search failed, switching to DB search: ${error.message}`);
      return this.fallbackDatabaseSearch(userId, query, limit);
    }
  },

  /**
   * Fallback SQL query search
   */
  async fallbackDatabaseSearch(userId: string, query: string, limit = 50) {
    const trimmed = query.trim();

    return prisma.emailRecipient.findMany({
      where: {
        email: {
          userId,
          ...(trimmed
            ? {
                OR: [
                  { subject: { contains: trimmed, mode: 'insensitive' } },
                  { body: { contains: trimmed, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        ...(trimmed
          ? {
              OR: [
                { recipientEmail: { contains: trimmed, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        email: {
          select: {
            id: true,
            subject: true,
            body: true,
            scheduledAt: true,
            createdAt: true,
            sender: {
              select: { email: true, name: true },
            },
          },
        },
        jobs: {
          select: {
            id: true,
            status: true,
            etherealPreviewUrl: true,
            executedAt: true,
            failureReason: true,
          },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },
};
