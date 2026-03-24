import { DynamoDBClient, ScanCommand, type AttributeValue } from '@aws-sdk/client-dynamodb';
import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const ddb = new DynamoDBClient();
const cognito = new CognitoIdentityProviderClient();

interface DayUsage {
  userId: string;
  email: string;
  type: string; // "user" (parsePdf) or "agent" (cvAgent)
  date: string;
  invocations: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
}

export const handler = async (event: {
  arguments: { days?: number };
  identity?: { claims?: Record<string, unknown> };
}): Promise<string> => {
  const groups = event.identity?.claims?.['cognito:groups'];
  const isAdmin = Array.isArray(groups) && groups.includes('ADMINS');
  if (!isAdmin) throw new Error('Non autorisé : accès admin requis');

  const tableName = process.env.USAGE_TABLE;
  if (!tableName) throw new Error('USAGE_TABLE manquant');

  const userPoolId = process.env.USER_POOL_ID;
  if (!userPoolId) throw new Error('USER_POOL_ID manquant');

  const days = Math.min(event.arguments.days || 30, 90);
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().slice(0, 10);

  // Scan DynamoDB for all usage records
  const items: DayUsage[] = [];
  let lastKey: Record<string, AttributeValue> | undefined;

  do {
    const result = await ddb.send(new ScanCommand({
      TableName: tableName,
      FilterExpression: 'sk >= :since',
      ExpressionAttributeValues: { ':since': { S: sinceStr } },
      ExclusiveStartKey: lastKey,
    }));

    for (const item of result.Items || []) {
      const pk = item.pk?.S || '';
      // pk format: "user#sub" or "agent#sub"
      const parts = pk.split('#');
      const type = parts[0] === 'agent' ? 'agent' : 'import';
      const userId = parts.slice(1).join('#');

      items.push({
        userId,
        email: '', // filled below
        type,
        date: item.sk?.S || '',
        invocations: parseInt(item.invocations?.N || '0'),
        totalTokens: parseInt(item.totalTokens?.N || '0'),
        inputTokens: parseInt(item.inputTokens?.N || '0'),
        outputTokens: parseInt(item.outputTokens?.N || '0'),
      });
    }

    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  // Resolve user emails from Cognito
  const uniqueSubs = [...new Set(items.map(i => i.userId))];
  const subToEmail: Record<string, string> = {};

  try {
    const { Users = [] } = await cognito.send(
      new ListUsersCommand({ UserPoolId: userPoolId, Limit: 60 })
    );
    for (const user of Users) {
      const sub = user.Attributes?.find(a => a.Name === 'sub')?.Value;
      const email = user.Attributes?.find(a => a.Name === 'email')?.Value;
      if (sub && email) subToEmail[sub] = email;
    }
  } catch { /* ignore if Cognito lookup fails */ }

  for (const item of items) {
    item.email = subToEmail[item.userId] || item.userId;
  }

  // Compute aggregates
  const totalTokens = items.reduce((s, i) => s + i.totalTokens, 0);
  const totalInvocations = items.reduce((s, i) => s + i.invocations, 0);
  const importInvocations = items.filter(i => i.type === 'import').reduce((s, i) => s + i.invocations, 0);
  const agentInvocations = items.filter(i => i.type === 'agent').reduce((s, i) => s + i.invocations, 0);
  const importTokens = items.filter(i => i.type === 'import').reduce((s, i) => s + i.totalTokens, 0);
  const agentTokens = items.filter(i => i.type === 'agent').reduce((s, i) => s + i.totalTokens, 0);

  // Per-user aggregates
  const perUser: Record<string, { email: string; invocations: number; tokens: number; importInvocations: number; agentInvocations: number }> = {};
  for (const item of items) {
    if (!perUser[item.userId]) {
      perUser[item.userId] = { email: item.email, invocations: 0, tokens: 0, importInvocations: 0, agentInvocations: 0 };
    }
    perUser[item.userId].invocations += item.invocations;
    perUser[item.userId].tokens += item.totalTokens;
    if (item.type === 'import') perUser[item.userId].importInvocations += item.invocations;
    else perUser[item.userId].agentInvocations += item.invocations;
  }

  // Daily totals for chart
  const dailyTotals: Record<string, { tokens: number; invocations: number }> = {};
  for (const item of items) {
    if (!dailyTotals[item.date]) dailyTotals[item.date] = { tokens: 0, invocations: 0 };
    dailyTotals[item.date].tokens += item.totalTokens;
    dailyTotals[item.date].invocations += item.invocations;
  }

  // Estimated cost (Claude Haiku 4.5 pricing: $0.80/M input, $4/M output)
  const inputTotal = items.reduce((s, i) => s + i.inputTokens, 0);
  const outputTotal = items.reduce((s, i) => s + i.outputTokens, 0);
  const estimatedCost = (inputTotal / 1_000_000) * 0.80 + (outputTotal / 1_000_000) * 4.0;

  return JSON.stringify({
    period: { days, since: sinceStr },
    totals: {
      invocations: totalInvocations,
      tokens: totalTokens,
      inputTokens: inputTotal,
      outputTokens: outputTotal,
      importInvocations,
      agentInvocations,
      importTokens,
      agentTokens,
      estimatedCostUsd: Math.round(estimatedCost * 10000) / 10000,
    },
    perUser: Object.values(perUser).sort((a, b) => b.tokens - a.tokens),
    daily: Object.entries(dailyTotals)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v })),
    details: items.sort((a, b) => b.date.localeCompare(a.date)),
  });
};
