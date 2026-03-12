import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';

const MODEL_ID = 'eu.anthropic.claude-haiku-4-5-20251001-v1:0';
const DAILY_LIMIT = 5;
const DAILY_TOKEN_LIMIT = 50_000;

const bedrock = new BedrockRuntimeClient();
const ddb = new DynamoDBClient();

const SYSTEM_PROMPT = `Tu es un expert en parsing de CV. Extrais les informations du texte fourni et retourne UNIQUEMENT un objet JSON brut (sans markdown, sans explication, sans balises de code).

Structure JSON attendue :
{
  "personal": { "firstName", "lastName", "title" (intitulé poste), "subtitle" (stack ex: "React / Node.js"), "website", "email", "phone", "linkedin", "company" },
  "sections": { "summary": "ClipboardList", "experiences": "Briefcase", "profile": "User", "skills": "Wrench", "education": "GraduationCap" },
  "summary": ["<b>Compétence clé</b>", ...],
  "experiences": [{ "id" (slug), "title", "client", "startDate", "endDate", "missions": [{ "id", "name", "tasks": [], "tools" }] }],
  "profileSkills": [{ "name", "level" (1-5, incréments 0.5) }],
  "skills": [{ "name", "details" }],
  "education": [{ "years", "degree", "school" }]
}

Règles :
- "sections" : garder EXACTEMENT les valeurs indiquées (noms d'icônes)
- "summary" : balises <b>...</b> autorisées pour les termes importants
- IDs : slugs URL-safe (minuscules, tirets)
- Champs absents : string vide ou tableau vide
- "company" : "Decision Network" si trouvé, sinon chaîne vide
- Retourner UNIQUEMENT le JSON brut`;

export const handler = async (event: {
  arguments: { pdfText: string };
  identity?: { sub?: string; claims?: Record<string, unknown> };
}): Promise<string> => {
  const pdfText = event.arguments.pdfText;
  if (!pdfText?.trim()) throw new Error('pdfText vide');

  const userId = event.identity?.sub;
  if (!userId) throw new Error('Utilisateur non identifié');

  const tableName = process.env.USAGE_TABLE;
  if (!tableName) throw new Error('USAGE_TABLE manquant');

  const today = new Date().toISOString().slice(0, 10);

  // Check current usage
  const usage = await ddb.send(new GetItemCommand({
    TableName: tableName,
    Key: { pk: { S: `user#${userId}` }, sk: { S: today } },
  }));

  const currentInvocations = parseInt(usage.Item?.invocations?.N || '0');
  const currentTokens = parseInt(usage.Item?.totalTokens?.N || '0');

  if (currentInvocations >= DAILY_LIMIT) {
    throw new Error(`Limite quotidienne atteinte (${DAILY_LIMIT} conversions/jour). Réessayez demain.`);
  }
  if (currentTokens >= DAILY_TOKEN_LIMIT) {
    throw new Error('Budget token journalier épuisé. Réessayez demain.');
  }

  const trimmed = pdfText.length > 30000 ? pdfText.slice(0, 30000) : pdfText;

  // Call Bedrock
  const response = await bedrock.send(new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: [{ type: 'text', text: `Parse ce CV :\n\n${trimmed}` }] }],
      max_tokens: 4096,
      temperature: 0,
    }),
  }));

  const data = JSON.parse(Buffer.from(response.body).toString()) as {
    content: Array<{ type: string; text: string }>;
    usage?: { input_tokens: number; output_tokens: number };
  };

  const firstBlock = data.content[0];
  if (!firstBlock || firstBlock.type !== 'text') throw new Error('Réponse Claude vide ou inattendue');

  const rawText = firstBlock.text
    .replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  JSON.parse(rawText); // validate JSON

  // Update usage counters
  const inputTokens = data.usage?.input_tokens || 0;
  const outputTokens = data.usage?.output_tokens || 0;
  const tokensUsed = inputTokens + outputTokens;
  const ttl = Math.floor(Date.now() / 1000) + 30 * 86400; // 30 days TTL

  await ddb.send(new UpdateItemCommand({
    TableName: tableName,
    Key: { pk: { S: `user#${userId}` }, sk: { S: today } },
    UpdateExpression: 'ADD invocations :one, totalTokens :tokens, inputTokens :inp, outputTokens :out SET #ttl = if_not_exists(#ttl, :ttl)',
    ExpressionAttributeNames: { '#ttl': 'ttl' },
    ExpressionAttributeValues: {
      ':one': { N: '1' },
      ':tokens': { N: String(tokensUsed) },
      ':inp': { N: String(inputTokens) },
      ':out': { N: String(outputTokens) },
      ':ttl': { N: String(ttl) },
    },
  }));

  return rawText;
};
