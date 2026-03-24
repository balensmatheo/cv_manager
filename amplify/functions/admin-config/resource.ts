import { defineFunction } from '@aws-amplify/backend';

export const adminConfigFunction = defineFunction({
  name: 'admin-config',
  entry: './handler.ts',
  timeoutSeconds: 15,
  resourceGroupName: 'data',
});
