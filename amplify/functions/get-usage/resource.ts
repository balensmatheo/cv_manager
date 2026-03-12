import { defineFunction } from '@aws-amplify/backend';

export const getUsageFunction = defineFunction({
  name: 'get-usage',
  entry: './handler.ts',
  resourceGroupName: 'data',
});
