import { defineFunction } from '@aws-amplify/backend';

export const getAllUsageFunction = defineFunction({
  name: 'get-all-usage',
  entry: './handler.ts',
  resourceGroupName: 'data',
});
