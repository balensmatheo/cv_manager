import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { parsePdfFunction } from '../functions/parse-pdf/resource';
import { getUsageFunction } from '../functions/get-usage/resource';
import { listUsersFunction } from '../functions/list-users/resource';
import { getUserCvFunction } from '../functions/get-user-cv/resource';
import { promoteUserFunction } from '../functions/promote-user/resource';

const schema = a.schema({
  parsePdf: a
    .query()
    .arguments({ pdfText: a.string().required() })
    .returns(a.string())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(parsePdfFunction)),

  getUsage: a
    .query()
    .arguments({})
    .returns(a.string())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(getUsageFunction)),

  listUsers: a
    .query()
    .arguments({})
    .returns(a.string())
    .authorization((allow) => [allow.group('admin')])
    .handler(a.handler.function(listUsersFunction)),

  getUserCv: a
    .query()
    .arguments({ username: a.string().required() })
    .returns(a.string())
    .authorization((allow) => [allow.group('admin')])
    .handler(a.handler.function(getUserCvFunction)),

  promoteUser: a
    .mutation()
    .arguments({ username: a.string().required(), group: a.string().required() })
    .returns(a.string())
    .authorization((allow) => [allow.group('admin')])
    .handler(a.handler.function(promoteUserFunction)),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: { defaultAuthorizationMode: 'userPool' },
});
