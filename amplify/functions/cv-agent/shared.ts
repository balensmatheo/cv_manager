import type {
  ToolConfiguration,
  SystemContentBlock,
} from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';

export const MODEL_ID = 'eu.anthropic.claude-haiku-4-5-20251001-v1:0';
export const DAILY_LIMIT = 20;
export const DAILY_TOKEN_LIMIT = 100_000;
export const MAX_TURNS = 5;

// ── Per-user limits helper ───────────────────────────────────────────────────
export interface UserLimits {
  dailyLimit: number;
  dailyTokenLimit: number;
}

export async function getUserLimits(
  ddb: DynamoDBClient,
  tableName: string,
  userId: string,
  type: 'agent' | 'import',
): Promise<UserLimits> {
  const defaults: UserLimits = type === 'agent'
    ? { dailyLimit: DAILY_LIMIT, dailyTokenLimit: DAILY_TOKEN_LIMIT }
    : { dailyLimit: 5, dailyTokenLimit: 50_000 };

  try {
    const result = await ddb.send(new GetItemCommand({
      TableName: tableName,
      Key: { pk: { S: `limits#${userId}` }, sk: { S: 'config' } },
    }));
    if (!result.Item) return defaults;

    const limitKey = type === 'agent' ? 'agentDailyLimit' : 'importDailyLimit';
    const tokenKey = type === 'agent' ? 'agentDailyTokenLimit' : 'importDailyTokenLimit';

    return {
      dailyLimit: result.Item[limitKey]?.N ? parseInt(result.Item[limitKey].N) : defaults.dailyLimit,
      dailyTokenLimit: result.Item[tokenKey]?.N ? parseInt(result.Item[tokenKey].N) : defaults.dailyTokenLimit,
    };
  } catch {
    return defaults;
  }
}

// ── Types ────────────────────────────────────────────────────────────────────
export interface CvData {
  personal: Record<string, string>;
  hook: string;
  sections: Record<string, string>;
  summary: string[];
  experiences: Array<{
    id: string; title: string; client: string;
    startDate: string; endDate: string;
    missions: Array<{ id: string; name: string; tasks: string[]; tools: string }>;
  }>;
  profileSkills: Array<{ name: string; level: number }>;
  skills: Array<{ name: string; details: string }>;
  education: Array<{ years: string; degree: string; school: string }>;
  interests: string[];
  settings?: Record<string, unknown>;
}

export interface HistoryEntry {
  role: 'user' | 'assistant';
  content: string;
}

// ── Condensed CV view ────────────────────────────────────────────────────────
export function condenseCv(cv: CvData): string {
  const lines: string[] = [];
  lines.push('=== INFORMATIONS PERSONNELLES ===');
  for (const [k, v] of Object.entries(cv.personal)) {
    if (v) lines.push(`${k}: ${v}`);
  }
  if (cv.hook) { lines.push('\n=== ACCROCHE ==='); lines.push(cv.hook); }
  if (cv.summary?.length) {
    lines.push('\n=== PROFIL (summary) ===');
    cv.summary.forEach((s, i) => lines.push(`[${i}] ${s}`));
  }
  if (cv.experiences?.length) {
    lines.push('\n=== EXPÉRIENCES ===');
    cv.experiences.forEach((exp, ei) => {
      lines.push(`\n[exp:${ei}] id="${exp.id}" | ${exp.title} — ${exp.client} (${exp.startDate} – ${exp.endDate})`);
      exp.missions.forEach((m, mi) => {
        lines.push(`  [mission:${ei}.${mi}] id="${m.id}" | ${m.name}`);
        m.tasks.forEach((t, ti) => lines.push(`    [tâche:${ei}.${mi}.${ti}] ${t}`));
        if (m.tools) lines.push(`    outils: ${m.tools}`);
      });
    });
  }
  if (cv.profileSkills?.length) {
    lines.push('\n=== PROFIL TECHNIQUE ===');
    cv.profileSkills.forEach((s, i) => lines.push(`[${i}] ${s.name} (${s.level}/5)`));
  }
  if (cv.skills?.length) {
    lines.push('\n=== COMPÉTENCES ===');
    cv.skills.forEach((s, i) => lines.push(`[${i}] ${s.name}: ${s.details}`));
  }
  if (cv.education?.length) {
    lines.push('\n=== FORMATIONS ===');
    cv.education.forEach((e, i) => lines.push(`[${i}] ${e.years} | ${e.degree} — ${e.school}`));
  }
  if (cv.interests?.length) {
    lines.push('\n=== CENTRES D\'INTÉRÊTS ===');
    cv.interests.forEach((s, i) => lines.push(`[${i}] ${s}`));
  }
  return lines.join('\n');
}

// ── Tool definitions (Converse API format) ───────────────────────────────────
export const TOOL_CONFIG: ToolConfiguration = {
  tools: [
    {
      toolSpec: {
        name: 'update_personal',
        description: 'Modifier un ou plusieurs champs personnels. Ne passer que les champs à modifier.',
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              firstName: { type: 'string' }, lastName: { type: 'string' },
              title: { type: 'string' }, subtitle: { type: 'string' },
              email: { type: 'string' }, phone: { type: 'string' },
              website: { type: 'string' }, linkedin: { type: 'string' },
              company: { type: 'string' }, address: { type: 'string' },
              driving: { type: 'string' },
            },
          },
        },
      },
    },
    {
      toolSpec: {
        name: 'set_hook',
        description: 'Définir ou modifier la phrase d\'accroche professionnelle.',
        inputSchema: {
          json: {
            type: 'object',
            properties: { text: { type: 'string' } },
            required: ['text'],
          },
        },
      },
    },
    {
      toolSpec: {
        name: 'set_summary',
        description: 'Remplacer les points clés du profil. Balises <b> autorisées.',
        inputSchema: {
          json: {
            type: 'object',
            properties: { items: { type: 'array', items: { type: 'string' } } },
            required: ['items'],
          },
        },
      },
    },
    {
      toolSpec: {
        name: 'add_experience',
        description: 'Ajouter une nouvelle expérience professionnelle.',
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              title: { type: 'string' }, client: { type: 'string' },
              startDate: { type: 'string' }, endDate: { type: 'string' },
              missions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    tasks: { type: 'array', items: { type: 'string' } },
                    tools: { type: 'string' },
                  },
                  required: ['name', 'tasks'],
                },
              },
            },
            required: ['title', 'client', 'startDate', 'endDate', 'missions'],
          },
        },
      },
    },
    {
      toolSpec: {
        name: 'update_experience',
        description: 'Modifier une expérience existante par son index (0-based).',
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              index: { type: 'integer' },
              title: { type: 'string' }, client: { type: 'string' },
              startDate: { type: 'string' }, endDate: { type: 'string' },
              missions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    tasks: { type: 'array', items: { type: 'string' } },
                    tools: { type: 'string' },
                  },
                  required: ['name', 'tasks'],
                },
              },
            },
            required: ['index'],
          },
        },
      },
    },
    {
      toolSpec: {
        name: 'remove_experience',
        description: 'Supprimer une expérience par son index (0-based).',
        inputSchema: {
          json: {
            type: 'object',
            properties: { index: { type: 'integer' } },
            required: ['index'],
          },
        },
      },
    },
    {
      toolSpec: {
        name: 'set_skills',
        description: 'Remplacer la liste des compétences.',
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              skills: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: { name: { type: 'string' }, details: { type: 'string' } },
                  required: ['name', 'details'],
                },
              },
            },
            required: ['skills'],
          },
        },
      },
    },
    {
      toolSpec: {
        name: 'set_profile_skills',
        description: 'Remplacer la liste des compétences techniques avec niveau 1-5.',
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              skills: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: { name: { type: 'string' }, level: { type: 'number' } },
                  required: ['name', 'level'],
                },
              },
            },
            required: ['skills'],
          },
        },
      },
    },
    {
      toolSpec: {
        name: 'set_education',
        description: 'Remplacer la liste des formations.',
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              education: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: { years: { type: 'string' }, degree: { type: 'string' }, school: { type: 'string' } },
                  required: ['years', 'degree', 'school'],
                },
              },
            },
            required: ['education'],
          },
        },
      },
    },
    {
      toolSpec: {
        name: 'set_interests',
        description: 'Remplacer la liste des centres d\'intérêt.',
        inputSchema: {
          json: {
            type: 'object',
            properties: { items: { type: 'array', items: { type: 'string' } } },
            required: ['items'],
          },
        },
      },
    },
    {
      toolSpec: {
        name: 'reject_request',
        description: 'Utiliser UNIQUEMENT si la demande n\'a AUCUN rapport avec un CV (ex: météo, blague, code).',
        inputSchema: {
          json: {
            type: 'object',
            properties: { reason: { type: 'string' } },
            required: ['reason'],
          },
        },
      },
    },
  ],
  toolChoice: { auto: {} },
};

export const SYSTEM: SystemContentBlock[] = [{
  text: `Tu es un assistant expert en CV professionnels.
Tu reçois une vue condensée du CV actuel et une instruction de l'utilisateur.

Tu peux :
1. RÉPONDRE en texte libre (analyse, feedback, conseils, vérification de fautes, questions) — sans appeler d'outil
2. MODIFIER le CV via les outils (update_personal, set_hook, set_summary, etc.)
3. COMBINER les deux : répondre en texte + appeler des outils dans la même réponse

Tu peux appeler PLUSIEURS outils en une seule réponse.

RÈGLES :
- Si l'utilisateur pose une QUESTION ou demande une ANALYSE (fautes, avis, suggestions) : réponds en texte. N'appelle les outils de modification QUE s'il le demande explicitement ou si tu corriges des fautes identifiées.
- N'invente JAMAIS d'informations non fournies par l'utilisateur
- Balises HTML autorisées dans le CV : <b>, <i>, <u>, <strong>, <em>
- IDs : slugs URL-safe (minuscules, tirets)
- Si la demande n'a AUCUN rapport avec un CV : appelle reject_request
- Pour traduire : traduis TOUS les contenus via les outils appropriés
- Pour adapter à un poste : reformule titre, accroche, compétences, tâches
- Sois concis et professionnel
- N'utilise PAS de markdown (**, ##, etc.) dans tes réponses textuelles. Utilise des tirets (-) pour les listes.
- Tu as accès à l'historique de conversation : tu peux référencer les échanges précédents`,
}];

// ── Apply a single tool call ─────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyToolCall(cv: CvData, name: string, inp: any): string {
  switch (name) {
    case 'reject_request':
      throw new Error(inp.reason || 'Demande non liée à un CV.');

    case 'update_personal':
      for (const [k, v] of Object.entries(inp)) {
        if (k in cv.personal) cv.personal[k] = v as string;
      }
      return 'Informations personnelles mises à jour';

    case 'set_hook':
      cv.hook = inp.text;
      return inp.text ? 'Accroche modifiée' : 'Accroche supprimée';

    case 'set_summary':
      cv.summary = inp.items;
      return `Profil : ${inp.items.length} points`;

    case 'add_experience': {
      const id = `exp-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      cv.experiences.push({
        id, title: inp.title, client: inp.client,
        startDate: inp.startDate, endDate: inp.endDate,
        missions: (inp.missions || []).map((m: { name: string; tasks: string[]; tools?: string }, i: number) => ({
          id: `m-${id}-${i}`, name: m.name, tasks: m.tasks, tools: m.tools || '',
        })),
      });
      return `Expérience ajoutée : ${inp.title}`;
    }

    case 'update_experience': {
      const idx = inp.index;
      if (idx < 0 || idx >= cv.experiences.length) return `Expérience [${idx}] introuvable`;
      const exp = cv.experiences[idx];
      if (inp.title !== undefined) exp.title = inp.title;
      if (inp.client !== undefined) exp.client = inp.client;
      if (inp.startDate !== undefined) exp.startDate = inp.startDate;
      if (inp.endDate !== undefined) exp.endDate = inp.endDate;
      if (inp.missions !== undefined) {
        exp.missions = inp.missions.map((m: { name: string; tasks: string[]; tools?: string }, i: number) => ({
          id: `m-${exp.id}-${i}`, name: m.name, tasks: m.tasks, tools: m.tools || '',
        }));
      }
      return `Expérience [${idx}] modifiée : ${exp.title}`;
    }

    case 'remove_experience': {
      const ri = inp.index;
      if (ri < 0 || ri >= cv.experiences.length) return `Expérience [${ri}] introuvable`;
      const removed = cv.experiences.splice(ri, 1)[0];
      return `Expérience supprimée : ${removed.title}`;
    }

    case 'set_skills':
      cv.skills = inp.skills;
      return `Compétences : ${inp.skills.length} éléments`;

    case 'set_profile_skills':
      cv.profileSkills = inp.skills;
      return `Profil technique : ${inp.skills.length} compétences`;

    case 'set_education':
      cv.education = inp.education;
      return `Formations : ${inp.education.length} éléments`;

    case 'set_interests':
      cv.interests = inp.items;
      return `Centres d'intérêt : ${inp.items.length} éléments`;

    default:
      return `Outil inconnu : ${name}`;
  }
}
