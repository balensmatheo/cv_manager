import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const ddb = new DynamoDBClient();
const s3 = new S3Client();

interface FunctionUrlEvent {
  requestContext?: { http?: { method?: string } };
  queryStringParameters?: Record<string, string>;
  body?: string;
}

function response(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

export const handler = async (event: FunctionUrlEvent) => {
  // Handle CORS preflight
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return response(200, {});
  }

  const tableName = process.env.USAGE_TABLE;
  const bucketName = process.env.BUCKET_NAME;
  if (!tableName || !bucketName) {
    return response(500, { error: 'Configuration serveur manquante' });
  }

  const token = event.queryStringParameters?.token;
  if (!token) {
    return response(400, { error: 'Token requis' });
  }

  // Look up the share record
  const result = await ddb.send(new GetItemCommand({
    TableName: tableName,
    Key: { pk: { S: `share#${token}` }, sk: { S: 'link' } },
  }));

  if (!result.Item) {
    return response(404, { error: 'Lien invalide ou expire' });
  }

  // Check expiration
  const expiresAt = result.Item.expiresAt?.S;
  if (expiresAt && new Date(expiresAt) < new Date()) {
    return response(410, { error: 'Ce lien a expire' });
  }

  const identityId = result.Item.identityId?.S;
  const cvId = result.Item.cvId?.S;
  if (!identityId || !cvId) {
    return response(500, { error: 'Donnees de partage corrompues' });
  }

  // Fetch CV from S3
  try {
    const obj = await s3.send(new GetObjectCommand({
      Bucket: bucketName,
      Key: `private/${identityId}/cvs/${cvId}.json`,
    }));
    const body = await obj.Body?.transformToString();
    if (!body) {
      return response(404, { error: 'CV introuvable' });
    }
    return response(200, { data: JSON.parse(body) });
  } catch {
    return response(404, { error: 'CV introuvable' });
  }
};
