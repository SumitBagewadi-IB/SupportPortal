#!/usr/bin/env node
/**
 * Zips lambda/index.mjs and deploys it to AWS Lambda.
 *
 * Usage:
 *   npm run deploy:lambda
 *   LAMBDA_FUNCTION=my-other-fn npm run deploy:lambda
 *
 * Required env vars (or set in .env.deploy):
 *   AWS_ACCESS_KEY_ID
 *   AWS_SECRET_ACCESS_KEY
 *   AWS_REGION          (default: ap-south-1)
 *   LAMBDA_FUNCTION     (default: ib-support-portal-api)
 */

import { createWriteStream, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { tmpdir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Load .env.deploy if present (plain KEY=VALUE, no shell expansion)
const envFile = join(ROOT, '.env.deploy');
if (existsSync(envFile)) {
  readFileSync(envFile, 'utf8')
    .split('\n')
    .forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eq = trimmed.indexOf('=');
      if (eq === -1) return;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    });
}

const REGION          = process.env.AWS_REGION        || 'ap-south-1';
const FUNCTION_NAME   = process.env.LAMBDA_FUNCTION   || 'ib-support-portal-api';
const LAMBDA_SRC      = join(ROOT, 'lambda', 'index.mjs');
const ZIP_PATH        = join(tmpdir(), 'lambda-deploy.zip');

if (!existsSync(LAMBDA_SRC)) {
  console.error(`❌  lambda/index.mjs not found at ${LAMBDA_SRC}`);
  process.exit(1);
}

if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  console.error('❌  AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set.');
  process.exit(1);
}

console.log(`\n📦  Zipping lambda/index.mjs → ${ZIP_PATH}`);
execSync(`zip -j "${ZIP_PATH}" "${LAMBDA_SRC}"`, { stdio: 'inherit' });

console.log(`\n🚀  Deploying to Lambda function: ${FUNCTION_NAME}  (${REGION})`);
execSync(
  `aws lambda update-function-code \
    --function-name "${FUNCTION_NAME}" \
    --zip-file "fileb://${ZIP_PATH}" \
    --region "${REGION}" \
    --no-cli-pager`,
  {
    stdio: 'inherit',
    env: process.env,
  }
);

console.log('\n✅  Lambda deployed successfully.');
