import { defineFunction } from '@aws-amplify/backend';

export const getUserCvFunction = defineFunction({
  name: 'get-user-cv',
  entry: './handler.ts',
  resourceGroupName: 'data',
});
