import { defineFunction } from '@aws-amplify/backend';

export const getSharedCvFunction = defineFunction({
  name: 'get-shared-cv',
  entry: './handler.ts',
  resourceGroupName: 'data',
});
