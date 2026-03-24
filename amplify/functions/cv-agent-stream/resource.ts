import { defineFunction } from '@aws-amplify/backend';

export const cvAgentStreamFunction = defineFunction({
  name: 'cv-agent-stream',
  entry: './handler.ts',
  timeoutSeconds: 60,
  resourceGroupName: 'data',
});
