import { defineFunction, secret } from '@aws-amplify/backend';

export const parsePdfFunction = defineFunction({
  name: 'parse-pdf',
  entry: './handler.ts',
  timeoutSeconds: 30,
  environment: {
    ANTHROPIC_API_KEY: secret('ANTHROPIC_API_KEY'),
  },
});
