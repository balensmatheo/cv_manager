import { defineBackend } from '@aws-amplify/backend';
import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import { Function as LambdaFunction } from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { RemovalPolicy } from 'aws-cdk-lib';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { parsePdfFunction } from './functions/parse-pdf/resource';
import { getUsageFunction } from './functions/get-usage/resource';
import { listUsersFunction } from './functions/list-users/resource';
import { getUserCvFunction } from './functions/get-user-cv/resource';
import { promoteUserFunction } from './functions/promote-user/resource';

const backend = defineBackend({
  auth,
  data,
  storage,
  parsePdfFunction,
  getUsageFunction,
  listUsersFunction,
  getUserCvFunction,
  promoteUserFunction,
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

// ── getUsage: read-only DynamoDB ─────────────────────────────────────────────
const getUsageLambda = backend.getUsageFunction.resources.lambda as LambdaFunction;
usageTable.grantReadData(getUsageLambda);
getUsageLambda.addEnvironment('USAGE_TABLE', usageTable.tableName);

// ── listUsers: Cognito read ──────────────────────────────────────────────────
const listUsersLambda = backend.listUsersFunction.resources.lambda as LambdaFunction;
listUsersLambda.addToRolePolicy(new PolicyStatement({
  effect: Effect.ALLOW,
  actions: ['cognito-idp:ListUsers', 'cognito-idp:AdminListGroupsForUser'],
  resources: [userPoolArn],
}));
listUsersLambda.addEnvironment('USER_POOL_ID', userPoolId);

// ── getUserCv: S3 + Cognito + Identity ──────────────────────────────────────
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
getUserCvLambda.addToRolePolicy(new PolicyStatement({
  effect: Effect.ALLOW,
  actions: ['cognito-identity:GetId'],
  resources: ['*'],
}));
getUserCvLambda.addEnvironment('USER_POOL_ID', userPoolId);
getUserCvLambda.addEnvironment('IDENTITY_POOL_ID', identityPoolId);
getUserCvLambda.addEnvironment('BUCKET_NAME', bucketName);

// ── promoteUser: Cognito groups ─────────────────────────────────────────────
const promoteUserLambda = backend.promoteUserFunction.resources.lambda as LambdaFunction;
promoteUserLambda.addToRolePolicy(new PolicyStatement({
  effect: Effect.ALLOW,
  actions: ['cognito-idp:AdminAddUserToGroup', 'cognito-idp:AdminRemoveUserFromGroup'],
  resources: [userPoolArn],
}));
promoteUserLambda.addEnvironment('USER_POOL_ID', userPoolId);
