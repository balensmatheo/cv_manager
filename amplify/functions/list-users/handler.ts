import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  AdminListGroupsForUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const cognito = new CognitoIdentityProviderClient();

interface UserInfo {
  username: string;
  email: string;
  groups: string[];
  createdAt: string;
  status: string;
}

export const handler = async (event: {
  arguments: Record<string, never>;
  identity?: { claims?: Record<string, unknown> };
}): Promise<string> => {
  const groups = event.identity?.claims?.['cognito:groups'];
  const isAdmin = Array.isArray(groups) && groups.includes('admin');
  if (!isAdmin) throw new Error('Non autorisé : accès admin requis');

  const userPoolId = process.env.USER_POOL_ID;
  if (!userPoolId) throw new Error('USER_POOL_ID manquant');

  const { Users = [] } = await cognito.send(
    new ListUsersCommand({ UserPoolId: userPoolId, Limit: 60 })
  );

  const result: UserInfo[] = [];
  for (const user of Users) {
    const emailAttr = user.Attributes?.find((a: { Name?: string }) => a.Name === 'email');
    const { Groups = [] } = await cognito.send(
      new AdminListGroupsForUserCommand({
        UserPoolId: userPoolId,
        Username: user.Username!,
      })
    );
    result.push({
      username: user.Username!,
      email: emailAttr?.Value ?? '',
      groups: Groups.map((g: { GroupName?: string }) => g.GroupName!),
      createdAt: user.UserCreateDate?.toISOString() ?? '',
      status: user.UserStatus ?? '',
    });
  }

  return JSON.stringify(result);
};
