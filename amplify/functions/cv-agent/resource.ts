import { defineFunction } from '@aws-amplify/backend';

export const cvAgentFunction = defineFunction({
  name: 'cv-agent',
  entry: './handler.ts',
  timeoutSeconds: 60,
  resourceGroupName: 'data',
});
