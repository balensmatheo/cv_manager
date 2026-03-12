import {
  CognitoIdentityProviderClient,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const cognito = new CognitoIdentityProviderClient();

export const handler = async (event: {
  arguments: { username: string; group: string };
  identity?: { claims?: Record<string, unknown> };
}): Promise<string> => {
  const groups = event.identity?.claims?.['cognito:groups'];
  const isAdmin = Array.isArray(groups) && groups.includes('admin');
  if (!isAdmin) throw new Error('Non autorisé : accès admin requis');

  const userPoolId = process.env.USER_POOL_ID;
  if (!userPoolId) throw new Error('USER_POOL_ID manquant');

  const { username, group } = event.arguments;
  if (!['admin', 'user'].includes(group)) throw new Error('Groupe invalide');

  // Remove from other groups, add to target
  const otherGroup = group === 'admin' ? 'user' : 'admin';
  try {
    await cognito.send(
      new AdminRemoveUserFromGroupCommand({
        UserPoolId: userPoolId,
        Username: username,
        GroupName: otherGroup,
      })
    );
  } catch { /* may not be in the other group */ }

  await cognito.send(
    new AdminAddUserToGroupCommand({
      UserPoolId: userPoolId,
      Username: username,
      GroupName: group,
    })
  );

  return JSON.stringify({ success: true, username, group });
};
