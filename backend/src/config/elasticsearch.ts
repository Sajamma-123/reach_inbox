import { Client } from '@elastic/elasticsearch';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

export const esClient = new Client({
  node: env.ELASTICSEARCH_NODE,
  maxRetries: 3,
  requestTimeout: 5000,
});

export const initElasticsearch = async (): Promise<boolean> => {
  try {
    const health = await esClient.cluster.health();
    logger.info(` Elasticsearch cluster connected: status [${health.status}]`);

    const indexExists = await esClient.indices.exists({
      index: env.ELASTICSEARCH_INDEX,
    });

    if (!indexExists) {
      await esClient.indices.create({
        index: env.ELASTICSEARCH_INDEX,
        body: {
          mappings: {
            properties: {
              emailId: { type: 'keyword' },
              userId: { type: 'keyword' },
              senderEmail: { type: 'keyword' },
              subject: { type: 'text' },
              body: { type: 'text' },
              recipientEmail: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              status: { type: 'keyword' },
              scheduledAt: { type: 'date' },
              createdAt: { type: 'date' },
            },
          },
        },
      });
      logger.info(` Elasticsearch index [${env.ELASTICSEARCH_INDEX}] created with mappings.`);
    }

    return true;
  } catch (error: any) {
    logger.warn(`⚠️ Elasticsearch not reachable at ${env.ELASTICSEARCH_NODE}. Search fallback to database will be used.`);
    return false;
  }
};
