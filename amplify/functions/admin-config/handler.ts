import { DynamoDBClient, GetItemCommand, PutItemCommand, DeleteItemCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { CognitoIdentityProviderClient, ListUsersCommand } from '@aws-sdk/client-cognito-identity-provider';

const ddb = new DynamoDBClient();
const cognito = new CognitoIdentityProviderClient();

// Default limits (must match what handlers use as fallback)
const DEFAULTS = {
  agent: {
    model: 'eu.anthropic.claude-haiku-4-5-20251001-v1:0',
    dailyLimit: 20,
    dailyTokenLimit: 100_000,
  },
  import: {
    model: 'eu.anthropic.claude-haiku-4-5-20251001-v1:0',
    dailyLimit: 5,
    dailyTokenLimit: 50_000,
  },
};

interface UserLimits {
  userId: string;
  email?: string;
  agentDailyLimit?: number;
  agentDailyTokenLimit?: number;
  importDailyLimit?: number;
  importDailyTokenLimit?: number;
}

export const handler = async (event: {
  arguments: { action: string; payload?: string };
  identity?: { sub?: string; claims?: Record<string, unknown> };
}): Promise<string> => {
  const { action, payload } = event.arguments;
  const tableName = process.env.USAGE_TABLE!;
  const userPoolId = process.env.USER_POOL_ID!;

  // Verify admin
  const groups = event.identity?.claims?.['cognito:groups'];
  const isAdmin = Array.isArray(groups)
    ? groups.includes('ADMINS')
    : typeof groups === 'string' && groups.includes('ADMINS');
  if (!isAdmin) throw new Error('Accès réservé aux administrateurs');

  switch (action) {
    case 'getConfig': {
      // Scan for all per-user limits
      const scan = await ddb.send(new ScanCommand({
        TableName: tableName,
        FilterExpression: 'begins_with(pk, :prefix) AND sk = :sk',
        ExpressionAttributeValues: {
          ':prefix': { S: 'limits#' },
          ':sk': { S: 'config' },
        },
      }));

      const userLimits: UserLimits[] = [];
      const userIds = new Set<string>();

      for (const item of scan.Items || []) {
        const userId = item.pk.S!.replace('limits#', '');
        userIds.add(userId);
        userLimits.push({
          userId,
          agentDailyLimit: item.agentDailyLimit?.N ? parseInt(item.agentDailyLimit.N) : undefined,
          agentDailyTokenLimit: item.agentDailyTokenLimit?.N ? parseInt(item.agentDailyTokenLimit.N) : undefined,
          importDailyLimit: item.importDailyLimit?.N ? parseInt(item.importDailyLimit.N) : undefined,
          importDailyTokenLimit: item.importDailyTokenLimit?.N ? parseInt(item.importDailyTokenLimit.N) : undefined,
        });
      }

      // Resolve emails for users with overrides
      if (userIds.size > 0) {
        try {
          const cognitoUsers = await cognito.send(new ListUsersCommand({
            UserPoolId: userPoolId,
            Limit: 60,
          }));
          const emailMap = new Map<string, string>();
          for (const u of cognitoUsers.Users || []) {
            const sub = u.Attributes?.find(a => a.Name === 'sub')?.Value;
            const email = u.Attributes?.find(a => a.Name === 'email')?.Value;
            if (sub && email) emailMap.set(sub, email);
          }
          for (const ul of userLimits) {
            ul.email = emailMap.get(ul.userId) || ul.userId;
          }
        } catch { /* ignore — just use userId */ }
      }

      return JSON.stringify({
        defaults: DEFAULTS,
        userOverrides: userLimits,
      });
    }

    case 'setUserLimits': {
      if (!payload) throw new Error('Payload manquant');
      const data = JSON.parse(payload) as UserLimits;
      if (!data.userId) throw new Error('userId manquant');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const item: Record<string, any> = {
        pk: { S: `limits#${data.userId}` },
        sk: { S: 'config' },
      };

      if (data.agentDailyLimit !== undefined)
        item.agentDailyLimit = { N: String(data.agentDailyLimit) };
      if (data.agentDailyTokenLimit !== undefined)
        item.agentDailyTokenLimit = { N: String(data.agentDailyTokenLimit) };
      if (data.importDailyLimit !== undefined)
        item.importDailyLimit = { N: String(data.importDailyLimit) };
      if (data.importDailyTokenLimit !== undefined)
        item.importDailyTokenLimit = { N: String(data.importDailyTokenLimit) };

      await ddb.send(new PutItemCommand({
        TableName: tableName,
        Item: item,
      }));

      return JSON.stringify({ ok: true });
    }

    case 'deleteUserLimits': {
      if (!payload) throw new Error('Payload manquant');
      const { userId } = JSON.parse(payload) as { userId: string };
      if (!userId) throw new Error('userId manquant');

      await ddb.send(new DeleteItemCommand({
        TableName: tableName,
        Key: { pk: { S: `limits#${userId}` }, sk: { S: 'config' } },
      }));

      return JSON.stringify({ ok: true });
    }

    default:
      throw new Error(`Action inconnue : ${action}`);
  }
};
