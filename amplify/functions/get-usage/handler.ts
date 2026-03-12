import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';

const ddb = new DynamoDBClient();
const DAILY_LIMIT = 5;
const DAILY_TOKEN_LIMIT = 50_000;

export const handler = async (event: {
  arguments: Record<string, never>;
  identity?: { sub?: string };
}): Promise<string> => {
  const userId = event.identity?.sub;
  if (!userId) throw new Error('Utilisateur non identifié');

  const tableName = process.env.USAGE_TABLE;
  if (!tableName) throw new Error('USAGE_TABLE manquant');

  const today = new Date().toISOString().slice(0, 10);

  const result = await ddb.send(new GetItemCommand({
    TableName: tableName,
    Key: { pk: { S: `user#${userId}` }, sk: { S: today } },
  }));

  const invocations = parseInt(result.Item?.invocations?.N || '0');
  const totalTokens = parseInt(result.Item?.totalTokens?.N || '0');
  const inputTokens = parseInt(result.Item?.inputTokens?.N || '0');
  const outputTokens = parseInt(result.Item?.outputTokens?.N || '0');

  return JSON.stringify({
    date: today,
    invocations,
    invocationsLimit: DAILY_LIMIT,
    invocationsRemaining: Math.max(0, DAILY_LIMIT - invocations),
    totalTokens,
    tokenLimit: DAILY_TOKEN_LIMIT,
    tokensRemaining: Math.max(0, DAILY_TOKEN_LIMIT - totalTokens),
    inputTokens,
    outputTokens,
  });
};
