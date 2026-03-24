import {
  BedrockRuntimeClient,
  ConverseStreamCommand,
  type Message,
  type ContentBlock,
  type ToolResultBlock,
} from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { Writable } from 'stream';
import {
  MODEL_ID, MAX_TURNS,
  type CvData, type HistoryEntry,
  condenseCv, TOOL_CONFIG, SYSTEM, applyToolCall, getUserLimits,
} from '../cv-agent/shared';

const bedrock = new BedrockRuntimeClient();
const ddb = new DynamoDBClient();

// ── JWT decode (no signature verification — token from our Cognito) ──────────
function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.replace(/^Bearer\s+/i, '').split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT');
  const payload = Buffer.from(parts[1], 'base64url').toString('utf8');
  return JSON.parse(payload) as Record<string, unknown>;
}

// ── SSE helper ───────────────────────────────────────────────────────────────
function sendEvent(stream: NodeJS.WritableStream, event: string, data: unknown) {
  stream.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler = awslambda.streamifyResponse(
  async (event: APIGatewayProxyEventV2, responseStream: Writable) => {
    // Response headers (CORS is handled by the Function URL config — do NOT set CORS headers here)
    const headers: Record<string, string> = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    };

    // Handle CORS preflight (Function URL handles this, but just in case)
    if (event.requestContext.http.method === 'OPTIONS') {
      const out = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: 204,
        headers,
      });
      out.end();
      return;
    }

    const stream = awslambda.HttpResponseStream.from(responseStream, {
      statusCode: 200,
      headers,
    });

    try {
      // ── Auth ───────────────────────────────────────────────────────────────
      const authHeader = event.headers?.authorization || event.headers?.Authorization;
      if (!authHeader) throw new Error('Non authentifié');

      const jwt = decodeJwtPayload(authHeader);
      const userId = jwt.sub as string;
      if (!userId) throw new Error('Token invalide');

      // Check token expiry
      const exp = jwt.exp as number;
      if (exp && exp < Math.floor(Date.now() / 1000)) {
        throw new Error('Token expiré');
      }

      // ── Parse body ─────────────────────────────────────────────────────────
      const rawBody = event.isBase64Encoded
        ? Buffer.from(event.body ?? '', 'base64').toString('utf8')
        : event.body ?? '';
      const body = JSON.parse(rawBody) as {
        cvJson: string;
        prompt: string;
        history?: string;
      };

      const { cvJson, prompt } = body;
      if (!cvJson?.trim()) throw new Error('CV JSON vide');
      if (!prompt?.trim()) throw new Error('Instruction vide');
      if (prompt.length > 2000) throw new Error('Instruction trop longue (max 2000 caractères)');

      // Parse conversation history
      let history: HistoryEntry[] = [];
      if (body.history) {
        try {
          const parsed = JSON.parse(body.history) as HistoryEntry[];
          history = parsed.slice(-6);
        } catch { /* ignore */ }
      }

      // ── Rate limiting ──────────────────────────────────────────────────────
      const tableName = process.env.USAGE_TABLE;
      if (!tableName) throw new Error('USAGE_TABLE manquant');

      const today = new Date().toISOString().slice(0, 10);

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

      sendEvent(stream, 'phase', { phase: 'analyzing' });

      // ── Parse CV ───────────────────────────────────────────────────────────
      const cv = JSON.parse(cvJson) as CvData;
      const condensed = condenseCv(cv);

      // Build conversation messages
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
      let totalInputTokens = 0;
      let totalOutputTokens = 0;

      // ── Multi-turn streaming loop ──────────────────────────────────────────
      for (let turn = 0; turn < MAX_TURNS; turn++) {
        const response = await bedrock.send(new ConverseStreamCommand({
          modelId: MODEL_ID,
          system: SYSTEM,
          messages,
          toolConfig: TOOL_CONFIG,
          inferenceConfig: { maxTokens: 4096, temperature: 0 },
        }));

        // Track content blocks for this turn
        const contentBlocks: ContentBlock[] = [];
        let currentBlockType: 'text' | 'toolUse' | null = null;
        let currentText = '';
        let currentToolUseId = '';
        let currentToolName = '';
        let currentToolInputJson = '';
        let stopReason = '';

        for await (const event of response.stream!) {
          // Content block start
          if (event.contentBlockStart) {
            const start = event.contentBlockStart.start;
            if (start?.toolUse) {
              currentBlockType = 'toolUse';
              currentToolUseId = start.toolUse.toolUseId || '';
              currentToolName = start.toolUse.name || '';
              currentToolInputJson = '';
              sendEvent(stream, 'phase', { phase: 'tool_use' });
              sendEvent(stream, 'tool_start', { name: currentToolName });
            } else {
              currentBlockType = 'text';
              currentText = '';
            }
          }

          // Content block delta
          if (event.contentBlockDelta) {
            const delta = event.contentBlockDelta.delta;
            if (delta?.text) {
              currentText += delta.text;
              sendEvent(stream, 'text', { delta: delta.text });
            }
            if (delta?.toolUse) {
              currentToolInputJson += delta.toolUse.input || '';
            }
          }

          // Content block stop
          if (event.contentBlockStop) {
            if (currentBlockType === 'text' && currentText) {
              contentBlocks.push({ text: currentText });
            }
            if (currentBlockType === 'toolUse') {
              let parsedInput = {};
              try {
                parsedInput = JSON.parse(currentToolInputJson || '{}');
              } catch { /* empty input */ }

              contentBlocks.push({
                toolUse: {
                  toolUseId: currentToolUseId,
                  name: currentToolName,
                  input: parsedInput,
                },
              });

              // Execute tool immediately and stream the result
              try {
                const action = applyToolCall(cv, currentToolName, parsedInput);
                allActions.push(action);
                sendEvent(stream, 'action', { text: action });
              } catch (err) {
                if (currentToolName === 'reject_request') {
                  throw err;
                }
                sendEvent(stream, 'action', {
                  text: err instanceof Error ? err.message : 'Erreur',
                  error: true,
                });
              }
            }
            currentBlockType = null;
          }

          // Message stop
          if (event.messageStop) {
            stopReason = event.messageStop.stopReason || '';
          }

          // Metadata (usage)
          if (event.metadata) {
            totalInputTokens += event.metadata.usage?.inputTokens || 0;
            totalOutputTokens += event.metadata.usage?.outputTokens || 0;
          }
        }

        // Add assistant message to conversation
        messages.push({ role: 'assistant', content: contentBlocks });

        // If no tool use, we're done
        const toolUseBlocks = contentBlocks.filter(b => 'toolUse' in b);
        if (toolUseBlocks.length === 0 || stopReason !== 'tool_use') {
          break;
        }

        // Build tool results for next turn
        const toolResults: ToolResultBlock[] = [];
        for (const block of toolUseBlocks) {
          if ('toolUse' in block && block.toolUse) {
            const { toolUseId, name, input } = block.toolUse;
            // Tool was already executed above, find its result in allActions
            // We need the result text — re-derive it or track it
            let resultText: string;
            try {
              // Re-execute is safe for idempotent tools since cv is already mutated
              // Just get the description
              resultText = getToolResultDescription(name!, input);
            } catch {
              resultText = 'OK';
            }
            toolResults.push({
              toolUseId: toolUseId!,
              content: [{ text: resultText }],
              status: 'success',
            });
          }
        }

        messages.push({
          role: 'user',
          content: toolResults.map(tr => ({ toolResult: tr }) as ContentBlock),
        });

        sendEvent(stream, 'phase', { phase: 'analyzing' });
      }

      // ── Send final result ──────────────────────────────────────────────────
      sendEvent(stream, 'phase', { phase: 'applying' });

      const tokensUsed = totalInputTokens + totalOutputTokens;

      // Update usage counters
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

      sendEvent(stream, 'done', {
        cv,
        actions: allActions,
        tokens: { input: totalInputTokens, output: totalOutputTokens, total: tokensUsed },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      sendEvent(stream, 'error', { message });
    } finally {
      stream.end();
    }
  },
);

// Helper to get a description for a tool result without re-executing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getToolResultDescription(name: string, _input: any): string {
  const descriptions: Record<string, string> = {
    update_personal: 'Informations personnelles mises à jour',
    set_hook: 'Accroche modifiée',
    set_summary: 'Profil mis à jour',
    add_experience: 'Expérience ajoutée',
    update_experience: 'Expérience modifiée',
    remove_experience: 'Expérience supprimée',
    set_skills: 'Compétences mises à jour',
    set_profile_skills: 'Profil technique mis à jour',
    set_education: 'Formations mises à jour',
    set_interests: 'Centres d\'intérêt mis à jour',
  };
  return descriptions[name] || 'OK';
}
