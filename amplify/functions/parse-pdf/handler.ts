import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { getUserLimits } from '../cv-agent/shared';

const MODEL_ID = 'eu.anthropic.claude-haiku-4-5-20251001-v1:0';

const bedrock = new BedrockRuntimeClient();
const ddb = new DynamoDBClient();

const SYSTEM_PROMPT = `Tu es un expert en parsing de CV. Extrais TOUTES les informations du texte fourni et retourne UNIQUEMENT un objet JSON brut (sans markdown, sans explication, sans balises de code).

Structure JSON EXACTE à retourner :
{
  "personal": {
    "firstName": "string",
    "lastName": "string",
    "title": "intitulé du poste actuel ou recherché",
    "subtitle": "stack technique ou spécialités séparées par /",
    "website": "url du site web si trouvé, sinon vide",
    "email": "adresse email",
    "phone": "numéro de téléphone",
    "linkedin": "url ou identifiant LinkedIn",
    "company": "nom de l'entreprise actuelle",
    "address": "adresse ou ville si mentionnée",
    "driving": "permis et/ou véhicule si mentionné (ex: Permis B - Véhiculé)"
  },
  "hook": "phrase d'accroche / objectif professionnel / résumé du profil en 1-3 phrases si présent dans le CV",
  "sections": { "summary": "ClipboardList", "experiences": "Briefcase", "profile": "User", "skills": "Wrench", "education": "GraduationCap", "interests": "Heart" },
  "summary": ["<b>Compétence clé 1</b>", "<b>Compétence clé 2</b>"],
  "experiences": [{
    "id": "slug-url-safe",
    "title": "intitulé du poste",
    "client": "nom du client ou entreprise",
    "startDate": "mois année",
    "endDate": "mois année ou Aujourd'hui",
    "missions": [{
      "id": "slug-url-safe",
      "name": "nom de la mission ou du projet",
      "tasks": ["description tâche 1", "description tâche 2"],
      "tools": "outil1, outil2, outil3"
    }]
  }],
  "profileSkills": [{ "name": "COMPÉTENCE", "level": 3.5 }],
  "skills": [{ "name": "Nom compétence", "details": "détails ou sous-compétences" }],
  "education": [{ "years": "20XX – 20XX", "degree": "intitulé diplôme", "school": "nom école" }],
  "interests": ["centre d'intérêt 1", "centre d'intérêt 2"]
}

Règles STRICTES :
- "sections" : copier EXACTEMENT les valeurs ci-dessus (noms d'icônes Lucide)
- "summary" : 3-5 points clés du profil, balises <b>...</b> sur les termes importants
- "hook" : phrase d'accroche, objectif ou profil si présent. Si absent, chaîne vide ""
- "experiences" : ordonnées de la plus récente à la plus ancienne. Regrouper les missions par poste/client
- "profileSkills" : compétences avec niveau de 1 à 5 (incréments 0.5). Évaluer le niveau selon l'expérience décrite
- "skills" : compétences techniques ou métier structurées par domaine
- "interests" : loisirs, centres d'intérêt, bénévolat, sport si mentionnés. Si absent, tableau vide []
- "address" / "driving" : extraire si mentionnés, sinon chaîne vide ""
- IDs : slugs URL-safe (minuscules, tirets, pas d'accents)
- Champs introuvables : string vide "" ou tableau vide []
- "company" : "Decision Network" si trouvé, sinon chaîne vide
- NE PAS inventer d'informations absentes du CV
- Retourner UNIQUEMENT le JSON brut, rien d'autre`;

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

  const limits = await getUserLimits(ddb, tableName, userId, 'import');

  if (currentInvocations >= limits.dailyLimit) {
    throw new Error(`Limite quotidienne atteinte (${limits.dailyLimit} conversions/jour). Réessayez demain.`);
  }
  if (currentTokens >= limits.dailyTokenLimit) {
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
      max_tokens: 8192,
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
