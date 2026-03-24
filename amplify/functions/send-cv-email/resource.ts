import { defineFunction } from '@aws-amplify/backend';

export const sendCvEmailFunction = defineFunction({
  name: 'send-cv-email',
  entry: './handler.ts',
  timeoutSeconds: 15,
  resourceGroupName: 'data',
});
