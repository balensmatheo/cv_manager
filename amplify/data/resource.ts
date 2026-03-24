import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { parsePdfFunction } from '../functions/parse-pdf/resource';
import { getUsageFunction } from '../functions/get-usage/resource';
import { cvAgentFunction } from '../functions/cv-agent/resource';
import { getAllUsageFunction } from '../functions/get-all-usage/resource';
import { listUsersFunction } from '../functions/list-users/resource';
import { getUserCvFunction } from '../functions/get-user-cv/resource';
import { promoteUserFunction } from '../functions/promote-user/resource';
import { adminConfigFunction } from '../functions/admin-config/resource';
import { sendCvEmailFunction } from '../functions/send-cv-email/resource';
import { createShareLinkFunction } from '../functions/create-share-link/resource';

const schema = a.schema({
  parsePdf: a
    .query()
    .arguments({ pdfText: a.string().required() })
    .returns(a.string())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(parsePdfFunction)),

  cvAgent: a
    .query()
    .arguments({ cvJson: a.string().required(), prompt: a.string().required(), history: a.string() })
    .returns(a.string())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(cvAgentFunction)),

  getUsage: a
    .query()
    .arguments({ identityId: a.string() })
    .returns(a.string())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(getUsageFunction)),

  getAllUsage: a
    .query()
    .arguments({ days: a.integer() })
    .returns(a.string())
    .authorization((allow) => [allow.group('ADMINS')])
    .handler(a.handler.function(getAllUsageFunction)),

  listUsers: a
    .query()
    .arguments({})
    .returns(a.string())
    .authorization((allow) => [allow.group('ADMINS')])
    .handler(a.handler.function(listUsersFunction)),

  getUserCv: a
    .query()
    .arguments({ username: a.string().required(), cvId: a.string() })
    .returns(a.string())
    .authorization((allow) => [allow.group('ADMINS')])
    .handler(a.handler.function(getUserCvFunction)),

  promoteUser: a
    .mutation()
    .arguments({ username: a.string().required(), group: a.string().required() })
    .returns(a.string())
    .authorization((allow) => [allow.group('ADMINS')])
    .handler(a.handler.function(promoteUserFunction)),

  adminConfig: a
    .mutation()
    .arguments({ action: a.string().required(), payload: a.string() })
    .returns(a.string())
    .authorization((allow) => [allow.group('ADMINS')])
    .handler(a.handler.function(adminConfigFunction)),

  sendCvEmail: a
    .mutation()
    .arguments({
      username: a.string().required(),
      cvId: a.string().required(),
      cvName: a.string().required(),
      recipientEmail: a.string().required(),
      senderName: a.string().required(),
      message: a.string(),
    })
    .returns(a.string())
    .authorization((allow) => [allow.group('ADMINS')])
    .handler(a.handler.function(sendCvEmailFunction)),

  createShareLink: a
    .mutation()
    .arguments({
      cvId: a.string().required(),
      expiresInDays: a.integer(),
    })
    .returns(a.string())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(createShareLinkFunction)),

});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: { defaultAuthorizationMode: 'userPool' },
});
