/**
 * @fileoverview CLI Test Script for Unified Email Service (Gmail API / Microsoft Graph / SMTP).
 *
 * Usage:
 *   node scripts/sendTestEmail.js <to_email> [from_email] [subject]
 *
 * Examples:
 *   node scripts/sendTestEmail.js test@example.com devp.ajitkumar@gmail.com "Gmail API Test"
 *   node scripts/sendTestEmail.js test@example.com it@spspl.com "Microsoft Graph Test"
 */
const path = require('path');
const fs = require('fs');

function loadEnvFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (process.env[key] === undefined) {
            process.env[key] = val;
          }
        }
      }
    }
  } catch (_e) {}
}

try {
  const dotenv = require('dotenv');
  dotenv.config({ path: path.resolve(__dirname, '../../.env.docker') });
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
  dotenv.config();
} catch (_err) {
  loadEnvFile(path.resolve(__dirname, '../../.env.docker'));
  loadEnvFile(path.resolve(__dirname, '../../.env'));
  loadEnvFile(path.resolve(process.cwd(), '.env'));
}

const mongoose = require('mongoose');
const env = require('../src/config/env');
const { getModels } = require('../src/data/mongoRegistry');
const unifiedEmailService = require('../src/modules/messages/services/unifiedEmail.service');

async function main() {
  const args = process.argv.slice(2);
  let to = args[0];
  let from = args[1];
  const subject = args[2] || `Test Email via OPMS Unified Email Service [${new Date().toLocaleTimeString()}]`;

  console.log('---------------------------------------------------------');
  console.log('🚀 OPMS Unified Email Test Runner');
  console.log('---------------------------------------------------------');

  // 1. Connect to MongoDB if URI is available
  let mongoUri = env.MONGODB_URI || process.env.MONGODB_URI;
  if (mongoUri) {
    // If running outside Docker on host, fallback mongo hostname to localhost
    if (mongoUri.includes('@mongo:') || mongoUri.includes('://mongo:')) {
      mongoUri = mongoUri.replace('@mongo:', '@127.0.0.1:').replace('://mongo:', '://127.0.0.1:');
    }
    try {
      console.log('📦 Connecting to MongoDB...');
      await mongoose.connect(mongoUri, {
        family: env.MONGODB_LOOKUP_FAMILY || 4,
        serverSelectionTimeoutMS: 4000,
      });
      console.log('✅ Connected to MongoDB successfully.');
    } catch (err) {
      console.warn(`⚠️ MongoDB connection warning: ${err.message}`);
    }
  } else {
    console.log('ℹ️ No MONGODB_URI found. Running with environment providers only.');
  }

  // 2. Query and list registered accounts
  const { EmailAccount } = getModels();
  let accounts = [];
  if (mongoose.connection.readyState === 1 && EmailAccount) {
    try {
      accounts = await EmailAccount.find({});
      console.log(`\n📋 Found ${accounts.length} registered email account(s) in database:`);
      accounts.forEach((acc, i) => {
        console.log(`   ${i + 1}. ${acc.email} (Provider: ${acc.provider}, Status: ${acc.status}, AuthType: ${acc.authType})`);
      });
    } catch (e) {
      console.warn(`⚠️ Failed to list accounts: ${e.message}`);
    }
  }

  // 3. Fallback defaults if no parameters passed
  if (!from && accounts.length > 0) {
    from = accounts[0].email;
    console.log(`\n👉 No sender specified. Defaulting sender to: ${from}`);
  }

  if (!to) {
    to = from || 'test@example.com';
    console.log(`👉 No recipient specified. Sending self-test to: ${to}`);
  }

  console.log('\n✉️ Sending test email:');
  console.log(`   • From:    ${from || '(Default Provider Mailbox)'}`);
  console.log(`   • To:      ${to}`);
  console.log(`   • Subject: ${subject}`);
  console.log('---------------------------------------------------------');

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #2563eb; color: white; padding: 20px; text-align: center;">
        <h2 style="margin: 0;">OPMS Unified Email Test</h2>
      </div>
      <div style="padding: 24px; color: #1e293b; line-height: 1.6;">
        <p>Hello,</p>
        <p>This is a successful test email sent through the <strong>OPMS Unified Email System</strong>.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background-color: #f8fafc;">
            <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; width: 30%;">Sender</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1;">${from || 'Default'}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold;">Recipient</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1;">${to}</td>
          </tr>
          <tr style="background-color: #f8fafc;">
            <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold;">Timestamp</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1;">${new Date().toISOString()}</td>
          </tr>
        </table>
        <p style="color: #64748b; font-size: 13px;">If you received this message, the email provider routing and API authorization are working as expected.</p>
      </div>
    </div>
  `;

  const textBody = `OPMS Unified Email Test\n\nSender: ${from || 'Default'}\nRecipient: ${to}\nTimestamp: ${new Date().toISOString()}\n\nThis is a test email confirming email integration is active.`;

  try {
    const result = await unifiedEmailService.send({
      from,
      to,
      subject,
      html: htmlBody,
      text: textBody,
    });

    console.log('\n🎉 SUCCESS! Email delivered successfully.');
    console.log(`   • Provider:   ${result.provider.toUpperCase()}`);
    console.log(`   • Message ID: ${result.messageId || 'N/A'}`);
    console.log(`   • Duration:   ${result.durationMs} ms`);
    console.log('---------------------------------------------------------');
  } catch (err) {
    console.error('\n❌ FAILED! Email delivery failed.');
    console.error(`   • Error Code:    ${err.code || 'UNKNOWN'}`);
    console.error(`   • Error Message: ${err.message}`);
    if (err.details) {
      console.error('   • Details:', err.details);
    }
    console.log('---------------------------------------------------------');
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

main();
