import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import {
  CognitoIdentityClient,
  GetIdCommand,
} from '@aws-sdk/client-cognito-identity';
import {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const s3 = new S3Client();
const cognitoIdp = new CognitoIdentityProviderClient();
const cognitoIdentity = new CognitoIdentityClient();

export const handler = async (event: {
  arguments: { username: string };
  identity?: { claims?: Record<string, unknown> };
}): Promise<string> => {
  const groups = event.identity?.claims?.['cognito:groups'];
  const isAdmin = Array.isArray(groups) && groups.includes('admin');
  if (!isAdmin) throw new Error('Non autorisé : accès admin requis');

  const bucketName = process.env.BUCKET_NAME;
  const userPoolId = process.env.USER_POOL_ID;
  const identityPoolId = process.env.IDENTITY_POOL_ID;
  const region = process.env.AWS_REGION || 'eu-west-1';
  if (!bucketName || !userPoolId || !identityPoolId) throw new Error('Variables d\'environnement manquantes');

  const targetUsername = event.arguments.username;

  // Get the user's sub from Cognito
  const userResponse = await cognitoIdp.send(
    new AdminGetUserCommand({ UserPoolId: userPoolId, Username: targetUsername })
  );
  const sub = userResponse.UserAttributes?.find((a: { Name?: string }) => a.Name === 'sub')?.Value;
  if (!sub) throw new Error('Utilisateur introuvable');

  // Get the identity ID for this user
  const providerName = `cognito-idp.${region}.amazonaws.com/${userPoolId}`;
  const { IdentityId } = await cognitoIdentity.send(
    new GetIdCommand({
      IdentityPoolId: identityPoolId,
      Logins: { [providerName]: sub },
    })
  );
  if (!IdentityId) throw new Error('Identity ID introuvable');

  // Try to get the resume.json from their private folder
  const prefix = `private/${IdentityId}/`;
  const { Contents = [] } = await s3.send(
    new ListObjectsV2Command({ Bucket: bucketName, Prefix: prefix })
  );

  const resumeKey = Contents.find(c => c.Key?.endsWith('resume.json'))?.Key;
  if (!resumeKey) return JSON.stringify({ found: false });

  const obj = await s3.send(new GetObjectCommand({ Bucket: bucketName, Key: resumeKey }));
  const body = await obj.Body?.transformToString();
  return JSON.stringify({ found: true, data: body ? JSON.parse(body) : null });
};
