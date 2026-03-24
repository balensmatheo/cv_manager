import { DynamoDBClient, GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { getUserLimits } from '../cv-agent/shared';

const ddb = new DynamoDBClient();

export const handler = async (event: {
  arguments: { identityId?: string };
  identity?: { sub?: string };
}): Promise<string> => {
  const userId = event.identity?.sub;
  if (!userId) throw new Error('Utilisateur non identifié');

  const tableName = process.env.USAGE_TABLE;
  if (!tableName) throw new Error('USAGE_TABLE manquant');

  // Store identityId mapping if provided
  const identityId = event.arguments.identityId;
  if (identityId) {
    await ddb.send(new PutItemCommand({
      TableName: tableName,
      Item: {
        pk: { S: `identity#${userId}` },
        sk: { S: 'map' },
        identityId: { S: identityId },
      },
    }));
  }

  const today = new Date().toISOString().slice(0, 10);

  const result = await ddb.send(new GetItemCommand({
    TableName: tableName,
    Key: { pk: { S: `user#${userId}` }, sk: { S: today } },
  }));

  const limits = await getUserLimits(ddb, tableName, userId, 'import');

  const invocations = parseInt(result.Item?.invocations?.N || '0');
  const totalTokens = parseInt(result.Item?.totalTokens?.N || '0');
  const inputTokens = parseInt(result.Item?.inputTokens?.N || '0');
  const outputTokens = parseInt(result.Item?.outputTokens?.N || '0');

  return JSON.stringify({
    date: today,
    invocations,
    invocationsLimit: limits.dailyLimit,
    invocationsRemaining: Math.max(0, limits.dailyLimit - invocations),
    totalTokens,
    tokenLimit: limits.dailyTokenLimit,
    tokensRemaining: Math.max(0, limits.dailyTokenLimit - totalTokens),
    inputTokens,
    outputTokens,
  });
};
