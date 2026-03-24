import { defineBackend } from '@aws-amplify/backend';
import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import { Function as LambdaFunction, FunctionUrlAuthType, InvokeMode, HttpMethod } from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { parsePdfFunction } from './functions/parse-pdf/resource';
import { getUsageFunction } from './functions/get-usage/resource';
import { cvAgentFunction } from './functions/cv-agent/resource';
import { cvAgentStreamFunction } from './functions/cv-agent-stream/resource';
import { getAllUsageFunction } from './functions/get-all-usage/resource';
import { listUsersFunction } from './functions/list-users/resource';
import { getUserCvFunction } from './functions/get-user-cv/resource';
import { promoteUserFunction } from './functions/promote-user/resource';
import { adminConfigFunction } from './functions/admin-config/resource';
import { sendCvEmailFunction } from './functions/send-cv-email/resource';

const backend = defineBackend({
  auth,
  data,
  storage,
  parsePdfFunction,
  getUsageFunction,
  cvAgentFunction,
  cvAgentStreamFunction,
  getAllUsageFunction,
  listUsersFunction,
  getUserCvFunction,
  promoteUserFunction,
  adminConfigFunction,
  sendCvEmailFunction,
});

const userPoolId = backend.auth.resources.userPool.userPoolId;
const userPoolArn = backend.auth.resources.userPool.userPoolArn;
const identityPoolId = backend.auth.resources.cfnResources.cfnIdentityPool.ref;
const bucketName = backend.storage.resources.bucket.bucketName;
const bucketArn = backend.storage.resources.bucket.bucketArn;

// ── DynamoDB Usage Tracking Table ─────────────────────────────────────────────
const usageTable = new dynamodb.Table(backend.data.resources.graphqlApi.stack, 'UsageTracking', {
  partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  timeToLiveAttribute: 'ttl',
  removalPolicy: RemovalPolicy.DESTROY,
});

// ── parsePdf: Bedrock + DynamoDB usage tracking ──────────────────────────────
const parsePdfLambda = backend.parsePdfFunction.resources.lambda as LambdaFunction;
parsePdfLambda.addToRolePolicy(new PolicyStatement({
  effect: Effect.ALLOW,
  actions: ['bedrock:InvokeModel'],
  resources: [
    'arn:aws:bedrock:*::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0',
    `arn:aws:bedrock:eu-west-1:${backend.auth.resources.userPool.stack.account}:inference-profile/eu.anthropic.claude-haiku-4-5-20251001-v1:0`,
  ],
}));
usageTable.grantReadWriteData(parsePdfLambda);
parsePdfLambda.addEnvironment('USAGE_TABLE', usageTable.tableName);

// ── cvAgent: Bedrock + DynamoDB usage tracking ───────────────────────────────
const cvAgentLambda = backend.cvAgentFunction.resources.lambda as LambdaFunction;
cvAgentLambda.addToRolePolicy(new PolicyStatement({
  effect: Effect.ALLOW,
  actions: ['bedrock:InvokeModel'],
  resources: [
    'arn:aws:bedrock:*::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0',
    `arn:aws:bedrock:eu-west-1:${backend.auth.resources.userPool.stack.account}:inference-profile/eu.anthropic.claude-haiku-4-5-20251001-v1:0`,
  ],
}));
usageTable.grantReadWriteData(cvAgentLambda);
cvAgentLambda.addEnvironment('USAGE_TABLE', usageTable.tableName);

// ── cvAgentStream: Bedrock streaming + DynamoDB + Function URL ───────────────
const cvAgentStreamLambda = backend.cvAgentStreamFunction.resources.lambda as LambdaFunction;
cvAgentStreamLambda.addToRolePolicy(new PolicyStatement({
  effect: Effect.ALLOW,
  actions: ['bedrock:InvokeModelWithResponseStream', 'bedrock:InvokeModel'],
  resources: [
    'arn:aws:bedrock:*::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0',
    `arn:aws:bedrock:eu-west-1:${backend.auth.resources.userPool.stack.account}:inference-profile/eu.anthropic.claude-haiku-4-5-20251001-v1:0`,
  ],
}));
usageTable.grantReadWriteData(cvAgentStreamLambda);
cvAgentStreamLambda.addEnvironment('USAGE_TABLE', usageTable.tableName);

// Add Function URL with response streaming
const streamFnUrl = cvAgentStreamLambda.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
  invokeMode: InvokeMode.RESPONSE_STREAM,
  cors: {
    allowedOrigins: ['*'],
    allowedHeaders: ['*'],
    allowedMethods: [HttpMethod.ALL],
  },
});

// Output the streaming URL for the frontend
new CfnOutput(backend.data.resources.graphqlApi.stack, 'CvAgentStreamUrl', {
  value: streamFnUrl.url,
  description: 'CV Agent Streaming Function URL',
});

// Also add to Amplify outputs so the frontend can discover it
backend.addOutput({
  custom: {
    cv_agent_stream_url: streamFnUrl.url,
  },
});

// ── getUsage: DynamoDB read + write (stores identity mapping) ───────────────
const getUsageLambda = backend.getUsageFunction.resources.lambda as LambdaFunction;
usageTable.grantReadWriteData(getUsageLambda);
getUsageLambda.addEnvironment('USAGE_TABLE', usageTable.tableName);

// ── getAllUsage: DynamoDB scan + Cognito read (admin) ─────────────────────────
const getAllUsageLambda = backend.getAllUsageFunction.resources.lambda as LambdaFunction;
usageTable.grantReadData(getAllUsageLambda);
getAllUsageLambda.addEnvironment('USAGE_TABLE', usageTable.tableName);
getAllUsageLambda.addEnvironment('USER_POOL_ID', userPoolId);
getAllUsageLambda.addToRolePolicy(new PolicyStatement({
  effect: Effect.ALLOW,
  actions: ['cognito-idp:ListUsers'],
  resources: [userPoolArn],
}));

// ── listUsers: Cognito read ──────────────────────────────────────────────────
const listUsersLambda = backend.listUsersFunction.resources.lambda as LambdaFunction;
listUsersLambda.addToRolePolicy(new PolicyStatement({
  effect: Effect.ALLOW,
  actions: ['cognito-idp:ListUsers', 'cognito-idp:AdminListGroupsForUser'],
  resources: [userPoolArn],
}));
listUsersLambda.addEnvironment('USER_POOL_ID', userPoolId);

// ── getUserCv: S3 + Cognito + DynamoDB (identity mapping) ───────────────────
const getUserCvLambda = backend.getUserCvFunction.resources.lambda as LambdaFunction;
getUserCvLambda.addToRolePolicy(new PolicyStatement({
  effect: Effect.ALLOW,
  actions: ['s3:GetObject', 's3:ListBucket'],
  resources: [bucketArn, `${bucketArn}/*`],
}));
getUserCvLambda.addToRolePolicy(new PolicyStatement({
  effect: Effect.ALLOW,
  actions: ['cognito-idp:AdminGetUser'],
  resources: [userPoolArn],
}));
usageTable.grantReadData(getUserCvLambda);
getUserCvLambda.addEnvironment('USER_POOL_ID', userPoolId);
getUserCvLambda.addEnvironment('USAGE_TABLE', usageTable.tableName);
getUserCvLambda.addEnvironment('BUCKET_NAME', bucketName);

// ── promoteUser: Cognito groups ─────────────────────────────────────────────
const promoteUserLambda = backend.promoteUserFunction.resources.lambda as LambdaFunction;
promoteUserLambda.addToRolePolicy(new PolicyStatement({
  effect: Effect.ALLOW,
  actions: ['cognito-idp:AdminAddUserToGroup', 'cognito-idp:AdminRemoveUserFromGroup'],
  resources: [userPoolArn],
}));
promoteUserLambda.addEnvironment('USER_POOL_ID', userPoolId);

// ── adminConfig: DynamoDB + Cognito ─────────────────────────────────────────
const adminConfigLambda = backend.adminConfigFunction.resources.lambda as LambdaFunction;
usageTable.grantReadWriteData(adminConfigLambda);
adminConfigLambda.addEnvironment('USAGE_TABLE', usageTable.tableName);
adminConfigLambda.addEnvironment('USER_POOL_ID', userPoolId);
adminConfigLambda.addToRolePolicy(new PolicyStatement({
  effect: Effect.ALLOW,
  actions: ['cognito-idp:ListUsers'],
  resources: [userPoolArn],
}));

// ── sendCvEmail: S3 + Cognito + DynamoDB + SES ─────────────────────────────
const sendCvEmailLambda = backend.sendCvEmailFunction.resources.lambda as LambdaFunction;
sendCvEmailLambda.addToRolePolicy(new PolicyStatement({
  effect: Effect.ALLOW,
  actions: ['s3:GetObject'],
  resources: [`${bucketArn}/*`],
}));
sendCvEmailLambda.addToRolePolicy(new PolicyStatement({
  effect: Effect.ALLOW,
  actions: ['cognito-idp:AdminGetUser'],
  resources: [userPoolArn],
}));
usageTable.grantReadData(sendCvEmailLambda);
sendCvEmailLambda.addToRolePolicy(new PolicyStatement({
  effect: Effect.ALLOW,
  actions: ['ses:SendEmail', 'ses:SendRawEmail'],
  resources: ['*'],
}));
sendCvEmailLambda.addEnvironment('USER_POOL_ID', userPoolId);
sendCvEmailLambda.addEnvironment('USAGE_TABLE', usageTable.tableName);
sendCvEmailLambda.addEnvironment('BUCKET_NAME', bucketName);
sendCvEmailLambda.addEnvironment('SENDER_EMAIL', 'noreply@decision-network.com');
