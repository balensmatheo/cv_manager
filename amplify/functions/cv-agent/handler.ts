import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Message,
  type ContentBlock,
  type ToolResultBlock,
} from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import {
  MODEL_ID, MAX_TURNS,
  type CvData, type HistoryEntry,
  condenseCv, TOOL_CONFIG, SYSTEM, applyToolCall, getUserLimits,
} from './shared';

const bedrock = new BedrockRuntimeClient();
const ddb = new DynamoDBClient();

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler = async (event: {
  arguments: { cvJson: string; prompt: string; history?: string };
  identity?: { sub?: string; claims?: Record<string, unknown> };
}): Promise<string> => {
  const { cvJson, prompt } = event.arguments;
  if (!cvJson?.trim()) throw new Error('CV JSON vide');
  if (!prompt?.trim()) throw new Error('Instruction vide');
  if (prompt.length > 2000) throw new Error('Instruction trop longue (max 2000 caractères)');

  // Parse conversation history (last N exchanges for context)
  let history: HistoryEntry[] = [];
  if (event.arguments.history) {
    try {
      const parsed = JSON.parse(event.arguments.history) as HistoryEntry[];
      history = parsed.slice(-6);
    } catch { /* ignore malformed history */ }
  }

  const userId = event.identity?.sub;
  if (!userId) throw new Error('Utilisateur non identifié');

  const tableName = process.env.USAGE_TABLE;
  if (!tableName) throw new Error('USAGE_TABLE manquant');

  const today = new Date().toISOString().slice(0, 10);

  // Check usage limits
  const usage = await ddb.send(new GetItemCommand({
    TableName: tableName,
    Key: { pk: { S: `agent#${userId}` }, sk: { S: today } },
  }));

  const currentInvocations = parseInt(usage.Item?.invocations?.N || '0');
  const currentTokens = parseInt(usage.Item?.totalTokens?.N || '0');

  const limits = await getUserLimits(ddb, tableName, userId, 'agent');

  if (currentInvocations >= limits.dailyLimit) {
    throw new Error(`Limite quotidienne atteinte (${limits.dailyLimit} modifications/jour). Réessayez demain.`);
  }
  if (currentTokens >= limits.dailyTokenLimit) {
    throw new Error('Budget token journalier épuisé. Réessayez demain.');
  }

  // Parse CV and build condensed view
  const cv = JSON.parse(cvJson) as CvData;
  const condensed = condenseCv(cv);

  // Build conversation messages with history
  const messages: Message[] = [];

  if (history.length > 0) {
    messages.push({
      role: 'user',
      content: [{ text: `CV ACTUEL :\n${condensed}\n\n---\nINSTRUCTION : ${history[0].content}` }],
    });
    for (let i = 1; i < history.length; i++) {
      messages.push({
        role: history[i].role,
        content: [{ text: history[i].content }],
      });
    }
    messages.push({
      role: 'user',
      content: [{ text: `CV MIS À JOUR :\n${condensed}\n\n---\nNOUVELLE INSTRUCTION : ${prompt}` }],
    });
  } else {
    messages.push({
      role: 'user',
      content: [{ text: `CV ACTUEL :\n${condensed}\n\n---\nINSTRUCTION : ${prompt}` }],
    });
  }

  const allActions: string[] = [];
  const textResponses: string[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // ── Multi-turn tool-use loop ───────────────────────────────────────────────
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await bedrock.send(new ConverseCommand({
      modelId: MODEL_ID,
      system: SYSTEM,
      messages,
      toolConfig: TOOL_CONFIG,
      inferenceConfig: { maxTokens: 4096, temperature: 0 },
    }));

    totalInputTokens += response.usage?.inputTokens || 0;
    totalOutputTokens += response.usage?.outputTokens || 0;

    const assistantContent = response.output?.message?.content || [];
    messages.push({ role: 'assistant', content: assistantContent });

    for (const block of assistantContent) {
      if ('text' in block && block.text) {
        textResponses.push(block.text);
      }
    }

    const toolUseBlocks = assistantContent.filter(
      (b): b is ContentBlock.ToolUseMember => 'toolUse' in b
    );

    if (toolUseBlocks.length === 0) break;

    const toolResults: ToolResultBlock[] = [];

    for (const block of toolUseBlocks) {
      const { toolUseId, name, input } = block.toolUse!;
      try {
        const action = applyToolCall(cv, name!, input);
        allActions.push(action);
        toolResults.push({
          toolUseId: toolUseId!,
          content: [{ text: action }],
          status: 'success',
        });
      } catch (err) {
        if (name === 'reject_request') throw err;
        toolResults.push({
          toolUseId: toolUseId!,
          content: [{ text: err instanceof Error ? err.message : 'Erreur' }],
          status: 'error',
        });
      }
    }

    messages.push({
      role: 'user',
      content: toolResults.map(tr => ({ toolResult: tr }) as ContentBlock),
    });

    if (response.stopReason !== 'tool_use') break;
  }

  const message = textResponses.join('\n\n').trim() || undefined;

  if (!message && allActions.length === 0) {
    throw new Error('L\'assistant n\'a effectué aucune action.');
  }

  // Update usage counters
  const tokensUsed = totalInputTokens + totalOutputTokens;
  const ttl = Math.floor(Date.now() / 1000) + 30 * 86400;

  await ddb.send(new UpdateItemCommand({
    TableName: tableName,
    Key: { pk: { S: `agent#${userId}` }, sk: { S: today } },
    UpdateExpression: 'ADD invocations :one, totalTokens :tokens, inputTokens :inp, outputTokens :out SET #ttl = if_not_exists(#ttl, :ttl)',
    ExpressionAttributeNames: { '#ttl': 'ttl' },
    ExpressionAttributeValues: {
      ':one': { N: '1' },
      ':tokens': { N: String(tokensUsed) },
      ':inp': { N: String(totalInputTokens) },
      ':out': { N: String(totalOutputTokens) },
      ':ttl': { N: String(ttl) },
    },
  }));

  return JSON.stringify({
    cv,
    actions: allActions,
    message,
    tokens: { input: totalInputTokens, output: totalOutputTokens, total: tokensUsed },
  });
};
