import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const s3 = new S3Client();
const ddb = new DynamoDBClient();
const cognitoIdp = new CognitoIdentityProviderClient();

async function resolveIdentityId(userPoolId: string, tableName: string, targetUsername: string): Promise<string> {
  // Get the user's sub from Cognito
  const userResponse = await cognitoIdp.send(
    new AdminGetUserCommand({ UserPoolId: userPoolId, Username: targetUsername })
  );
  const sub = userResponse.UserAttributes?.find((a: { Name?: string }) => a.Name === 'sub')?.Value;
  if (!sub) throw new Error('Utilisateur introuvable');

  // Look up identityId from DynamoDB mapping (stored by frontend via getUsage)
  const mapping = await ddb.send(new GetItemCommand({
    TableName: tableName,
    Key: { pk: { S: `identity#${sub}` }, sk: { S: 'map' } },
  }));

  const identityId = mapping.Item?.identityId?.S;
  if (!identityId) throw new Error('Cet utilisateur ne s\'est pas encore connecté (identityId non résolu). Demandez-lui de se connecter d\'abord.');

  return identityId;
}

export const handler = async (event: {
  arguments: { username: string; cvId?: string };
  identity?: { claims?: Record<string, unknown> };
}): Promise<string> => {
  const groups = event.identity?.claims?.['cognito:groups'];
  const isAdmin = Array.isArray(groups) && groups.includes('ADMINS');
  if (!isAdmin) throw new Error('Non autorisé : accès admin requis');

  const bucketName = process.env.BUCKET_NAME;
  const userPoolId = process.env.USER_POOL_ID;
  const tableName = process.env.USAGE_TABLE;
  if (!bucketName || !userPoolId || !tableName) throw new Error('Variables d\'environnement manquantes');

  const { username: targetUsername, cvId } = event.arguments;

  const identityId = await resolveIdentityId(userPoolId, tableName, targetUsername);
  const prefix = `private/${identityId}/`;

  // If cvId is provided, return that specific CV
  if (cvId) {
    try {
      const obj = await s3.send(new GetObjectCommand({
        Bucket: bucketName,
        Key: `${prefix}cvs/${cvId}.json`,
      }));
      const body = await obj.Body?.transformToString();
      return JSON.stringify({ found: true, data: body ? JSON.parse(body) : null });
    } catch {
      return JSON.stringify({ found: false });
    }
  }

  // Otherwise, list all CVs (cv-index.json)
  try {
    const indexObj = await s3.send(new GetObjectCommand({
      Bucket: bucketName,
      Key: `${prefix}cv-index.json`,
    }));
    const indexBody = await indexObj.Body?.transformToString();
    const cvIndex = indexBody ? JSON.parse(indexBody) : [];
    return JSON.stringify({ found: true, cvs: cvIndex });
  } catch {
    // Fallback: try legacy resume.json
    const { Contents = [] } = await s3.send(
      new ListObjectsV2Command({ Bucket: bucketName, Prefix: prefix })
    );
    const resumeKey = Contents.find(c => c.Key?.endsWith('resume.json'))?.Key;
    if (!resumeKey) return JSON.stringify({ found: false, cvs: [] });

    const obj = await s3.send(new GetObjectCommand({ Bucket: bucketName, Key: resumeKey }));
    const body = await obj.Body?.transformToString();
    return JSON.stringify({
      found: true,
      cvs: [{ id: '_legacy', name: 'CV (legacy)', createdAt: '', updatedAt: '' }],
      legacyData: body ? JSON.parse(body) : null,
    });
  }
};
