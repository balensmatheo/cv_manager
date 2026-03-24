import { DynamoDBClient, PutItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { randomBytes } from 'crypto';

const ddb = new DynamoDBClient();

export const handler = async (event: {
  arguments: {
    cvId: string;
    expiresInDays?: number;
  };
  identity?: { sub?: string };
}): Promise<string> => {
  const userId = event.identity?.sub;
  if (!userId) throw new Error('Utilisateur non identifie');

  const tableName = process.env.USAGE_TABLE;
  if (!tableName) throw new Error('USAGE_TABLE manquant');

  const { cvId, expiresInDays = 7 } = event.arguments;
  if (!cvId) throw new Error('cvId requis');

  // Resolve identityId from DynamoDB mapping
  const mapping = await ddb.send(new GetItemCommand({
    TableName: tableName,
    Key: { pk: { S: `identity#${userId}` }, sk: { S: 'map' } },
  }));
  const identityId = mapping.Item?.identityId?.S;
  if (!identityId) throw new Error('identityId non resolu');

  // Generate a unique token
  const token = randomBytes(24).toString('base64url');

  // TTL: current time + expiresInDays
  const days = Math.min(Math.max(expiresInDays, 1), 30);
  const ttl = Math.floor(Date.now() / 1000) + days * 86400;
  const expiresAt = new Date(ttl * 1000).toISOString();

  // Store share record
  await ddb.send(new PutItemCommand({
    TableName: tableName,
    Item: {
      pk: { S: `share#${token}` },
      sk: { S: 'link' },
      identityId: { S: identityId },
      cvId: { S: cvId },
      userId: { S: userId },
      createdAt: { S: new Date().toISOString() },
      expiresAt: { S: expiresAt },
      ttl: { N: String(ttl) },
    },
  }));

  return JSON.stringify({ token, expiresAt });
};
