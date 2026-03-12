import { defineFunction } from '@aws-amplify/backend';

export const listUsersFunction = defineFunction({
  name: 'list-users',
  entry: './handler.ts',
  resourceGroupName: 'data',
});
