import { defineFunction } from '@aws-amplify/backend';

export const createShareLinkFunction = defineFunction({
  name: 'create-share-link',
  entry: './handler.ts',
  resourceGroupName: 'data',
});
