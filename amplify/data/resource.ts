import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { parsePdfFunction } from '../functions/parse-pdf/resource';

const schema = a.schema({
  parsePdf: a
    .query()
    .arguments({ pdfText: a.string().required() })
    .returns(a.string())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(parsePdfFunction)),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: { defaultAuthorizationMode: 'userPool' },
});
