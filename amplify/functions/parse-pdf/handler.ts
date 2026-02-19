import type { Schema } from '../../data/resource';
import Anthropic from '@anthropic-ai/sdk';

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

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const handler: Schema['parsePdf']['functionHandler'] = async (event) => {
  const pdfText = event.arguments.pdfText;
  if (!pdfText?.trim()) throw new Error('pdfText vide');

  const trimmed = pdfText.length > 30000 ? pdfText.slice(0, 30000) : pdfText;

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Parse ce CV :\n\n${trimmed}` }],
  });

  const rawText = (msg.content[0] as { type: string; text: string }).text
    .replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  JSON.parse(rawText); // valide le JSON avant de retourner
  return rawText;      // retourne la string JSON → le frontend fait JSON.parse()
};
