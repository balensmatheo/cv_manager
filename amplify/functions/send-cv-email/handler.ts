import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const ses = new SESClient();
const s3 = new S3Client();
const ddb = new DynamoDBClient();
const cognitoIdp = new CognitoIdentityProviderClient();

interface CvData {
  personal: Record<string, string>;
  hook: string;
  sections: Record<string, string>;
  summary: string[];
  experiences: Array<{
    title: string; client: string;
    startDate: string; endDate: string;
    missions: Array<{ name: string; tasks: string[]; tools: string }>;
  }>;
  profileSkills: Array<{ name: string; level: number }>;
  skills: Array<{ name: string; details: string }>;
  education: Array<{ years: string; degree: string; school: string }>;
  interests: string[];
  settings?: Record<string, unknown>;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function generateCvHtml(cv: CvData, cvName: string): string {
  const accent = (cv.settings?.accentColor as string) || '#7B2882';

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; font-size: 14px; line-height: 1.6; max-width: 700px; margin: 0 auto; padding: 20px; }
    h1 { color: ${accent}; font-size: 22px; margin: 0; }
    h2 { color: ${accent}; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid ${accent}; padding-bottom: 4px; margin: 20px 0 10px; }
    h3 { font-size: 14px; margin: 8px 0 2px; }
    .subtitle { color: #777; font-size: 13px; }
    .hook { font-style: italic; color: #444; margin: 10px 0; }
    .badge { display: inline-block; background: ${accent}20; color: ${accent}; font-size: 11px; padding: 2px 8px; border-radius: 10px; margin: 1px 2px; }
    ul { margin: 4px 0; padding-left: 20px; }
    li { margin-bottom: 2px; }
    .period { color: #999; font-size: 12px; }
    .mission { margin-left: 10px; margin-bottom: 8px; }
    .skills-grid { display: flex; flex-wrap: wrap; gap: 6px; }
    .footer { text-align: center; color: #bbb; font-size: 11px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px; }
  </style></head><body>`;

  html += `<h1>${esc(cv.personal.firstName || '')} ${esc(cv.personal.lastName || '')}</h1>`;
  if (cv.personal.title) html += `<div style="font-size:16px;font-weight:700;margin:4px 0">${esc(cv.personal.title)}</div>`;
  if (cv.personal.subtitle) html += `<div class="subtitle">${esc(cv.personal.subtitle)}</div>`;

  const contactParts = [cv.personal.email, cv.personal.phone, cv.personal.website, cv.personal.linkedin].filter(Boolean);
  if (contactParts.length) html += `<div class="subtitle">${contactParts.map(esc).join(' · ')}</div>`;

  if (cv.hook) html += `<div class="hook">${esc(cv.hook)}</div>`;

  if (cv.summary?.length) {
    html += `<h2>Profil</h2><ul>`;
    cv.summary.forEach(s => { html += `<li>${s}</li>`; });
    html += `</ul>`;
  }

  if (cv.experiences?.length) {
    html += `<h2>Expériences professionnelles</h2>`;
    cv.experiences.forEach(exp => {
      html += `<h3>${esc(exp.title)}${exp.client ? ` — <span style="color:${accent}">${esc(exp.client)}</span>` : ''}</h3>`;
      html += `<div class="period">${esc(exp.startDate)} – ${esc(exp.endDate)}</div>`;
      exp.missions.forEach(m => {
        html += `<div class="mission"><strong>Mission :</strong> ${esc(m.name)}<ul>`;
        m.tasks.forEach(t => { html += `<li>${esc(t)}</li>`; });
        html += `</ul>`;
        if (m.tools) {
          html += `<div>${m.tools.split(',').map(t => `<span class="badge">${esc(t.trim())}</span>`).join(' ')}</div>`;
        }
        html += `</div>`;
      });
    });
  }

  if (cv.skills?.length) {
    html += `<h2>Compétences</h2><div class="skills-grid">`;
    cv.skills.forEach(s => {
      html += `<div style="flex:1;min-width:200px;margin-bottom:8px"><strong style="color:${accent}">${esc(s.name)}</strong><br><span style="color:#555;font-size:13px">${esc(s.details)}</span></div>`;
    });
    html += `</div>`;
  }

  if (cv.education?.length) {
    html += `<h2>Formations</h2>`;
    cv.education.forEach(e => {
      html += `<div style="margin-bottom:6px"><strong>${esc(e.degree)}</strong> — <span style="color:#777">${esc(e.school)}</span><br><span class="period">${esc(e.years)}</span></div>`;
    });
  }

  if (cv.interests?.length) {
    html += `<h2>Centres d'intérêt</h2><p>${cv.interests.map(esc).join(' · ')}</p>`;
  }

  html += `<div class="footer">CV « ${esc(cvName)} » envoyé via CV Manager</div>`;
  html += `</body></html>`;
  return html;
}

async function resolveIdentityId(userPoolId: string, tableName: string, username: string): Promise<string> {
  const userResponse = await cognitoIdp.send(
    new AdminGetUserCommand({ UserPoolId: userPoolId, Username: username })
  );
  const sub = userResponse.UserAttributes?.find((a: { Name?: string }) => a.Name === 'sub')?.Value;
  if (!sub) throw new Error('Utilisateur introuvable');

  const mapping = await ddb.send(new GetItemCommand({
    TableName: tableName,
    Key: { pk: { S: `identity#${sub}` }, sk: { S: 'map' } },
  }));

  const identityId = mapping.Item?.identityId?.S;
  if (!identityId) throw new Error('IdentityId non résolu. L\'utilisateur doit se connecter d\'abord.');

  return identityId;
}

export const handler = async (event: {
  arguments: {
    username: string;
    cvId: string;
    cvName: string;
    recipientEmail: string;
    senderName: string;
    message?: string;
  };
  identity?: { claims?: Record<string, unknown> };
}): Promise<string> => {
  const groups = event.identity?.claims?.['cognito:groups'];
  const isAdmin = Array.isArray(groups) && groups.includes('ADMINS');
  if (!isAdmin) throw new Error('Non autorisé : accès admin requis');

  const { username, cvId, cvName, recipientEmail, senderName, message } = event.arguments;
  if (!recipientEmail?.includes('@')) throw new Error('Email destinataire invalide');

  const bucketName = process.env.BUCKET_NAME!;
  const userPoolId = process.env.USER_POOL_ID!;
  const tableName = process.env.USAGE_TABLE!;
  const senderEmail = process.env.SENDER_EMAIL!;

  const identityId = await resolveIdentityId(userPoolId, tableName, username);

  // Load CV data
  const s3Key = cvId === '_legacy'
    ? `private/${identityId}/resume.json`
    : `private/${identityId}/cvs/${cvId}.json`;

  const obj = await s3.send(new GetObjectCommand({ Bucket: bucketName, Key: s3Key }));
  const cvData = JSON.parse(await obj.Body!.transformToString()) as CvData;

  // Generate HTML and send email
  const htmlBody = generateCvHtml(cvData, cvName);
  const fullName = [cvData.personal.firstName, cvData.personal.lastName].filter(Boolean).join(' ') || 'Candidat';

  const customMessage = message?.trim()
    ? `<div style="background:#f9f9f9;border-left:3px solid #7B2882;padding:12px 16px;margin:0 0 20px;font-size:14px;color:#333">${esc(message)}</div>`
    : '';

  const emailHtml = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:700px;margin:0 auto">
      <div style="background:#7B2882;color:white;padding:16px 20px;border-radius:8px 8px 0 0">
        <h2 style="margin:0;font-size:18px">CV de ${esc(fullName)}</h2>
        <p style="margin:4px 0 0;opacity:0.8;font-size:13px">Envoyé par ${esc(senderName)}</p>
      </div>
      <div style="padding:20px;border:1px solid #eee;border-top:none;border-radius:0 0 8px 8px">
        ${customMessage}
        ${htmlBody}
      </div>
    </div>
  `;

  await ses.send(new SendEmailCommand({
    Source: senderEmail,
    Destination: { ToAddresses: [recipientEmail] },
    Message: {
      Subject: { Data: `CV de ${fullName} — ${cvName}`, Charset: 'UTF-8' },
      Body: {
        Html: { Data: emailHtml, Charset: 'UTF-8' },
      },
    },
  }));

  return JSON.stringify({ ok: true });
};
