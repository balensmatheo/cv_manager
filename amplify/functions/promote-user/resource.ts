import { defineFunction } from '@aws-amplify/backend';

export const promoteUserFunction = defineFunction({
  name: 'promote-user',
  entry: './handler.ts',
  resourceGroupName: 'data',
});
