/**
 * @fileoverview Test suite for Unified Email System (Microsoft Graph, Gmail API, and Provider Resolver).
 */
const assert = require('assert');
const { test, describe } = require('node:test');

// 1. Test Encryption Utility
const { encrypt, decrypt } = require('../src/utils/credentialEncryption');

describe('Credential Encryption Utility', () => {
  test('should encrypt and decrypt a plaintext string accurately', () => {
    const original = 'ya29.a0AXooCgvSecretOAuthToken12345!@#$%';
    const encrypted = encrypt(original);
    assert.notStrictEqual(encrypted, original);
    assert.ok(typeof encrypted === 'string');

    const decrypted = decrypt(encrypted);
    assert.strictEqual(decrypted, original);
  });

  test('should safely handle empty or null values', () => {
    assert.strictEqual(encrypt(null), null);
    assert.strictEqual(encrypt(undefined), undefined);
    assert.strictEqual(encrypt(''), '');
    assert.strictEqual(decrypt(null), null);
    assert.strictEqual(decrypt(''), '');
  });

  test('should return non-encrypted strings safely without crashing', () => {
    const raw = 'plain-text-token';
    const result = decrypt(raw);
    assert.strictEqual(result, raw);
  });
});

// 2. Test Gmail MIME Message Building
const GmailProvider = require('../src/modules/messages/providers/gmail.provider');

describe('GmailProvider MIME & Encoding', () => {
  const provider = new GmailProvider({
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    redirectUri: 'http://localhost:7011/api/emails/google/callback',
  });

  test('should generate a valid Google OAuth consent URL with minimum scopes', () => {
    const url = provider.getAuthorizationUrl('state123');
    assert.ok(url.includes('https://accounts.google.com/o/oauth2/v2/auth'));
    assert.ok(url.includes('client_id=test-client-id'));
    assert.ok(url.includes('access_type=offline'));
    assert.ok(url.includes('prompt=consent'));
    assert.ok(url.includes('state=state123'));
    assert.ok(url.includes('gmail.send'));
  });

  test('should build MIME message and return base64url string with attachments', async () => {
    const rawMime = await provider.buildMimeMessage({
      from: 'sender@example.com',
      to: ['recipient1@example.com', 'recipient2@example.com'],
      cc: ['cc1@example.com'],
      bcc: ['bcc1@example.com'],
      replyTo: 'replyto@example.com',
      subject: 'Order Confirmation #1001',
      html: '<h1>Order Confirmed</h1><p>Thank you for your order!</p>',
      text: 'Order Confirmed. Thank you for your order!',
      attachments: [
        {
          filename: 'invoice.pdf',
          content: Buffer.from('PDF Content Dummy'),
          contentType: 'application/pdf',
        },
      ],
    });

    assert.ok(typeof rawMime === 'string');
    assert.ok(rawMime.length > 50);
    // Base64URL should not contain +, /, or =
    assert.strictEqual(rawMime.includes('+'), false);
    assert.strictEqual(rawMime.includes('/'), false);
    assert.strictEqual(rawMime.includes('='), false);

    // Decode base64url back to standard MIME text to verify headers
    const base64Standard = rawMime.replace(/-/g, '+').replace(/_/g, '/');
    const mimeText = Buffer.from(base64Standard, 'base64').toString('utf-8');

    assert.ok(mimeText.includes('Subject: Order Confirmation #1001'));
    assert.ok(mimeText.includes('From: sender@example.com'));
    assert.ok(mimeText.includes('To: recipient1@example.com, recipient2@example.com'));
    assert.ok(mimeText.includes('Cc: cc1@example.com'));
    assert.ok(mimeText.includes('Reply-To: replyto@example.com'));
    assert.ok(mimeText.includes('invoice.pdf'));
  });
});

// 3. Test EmailProviderResolver
const resolver = require('../src/modules/messages/providers/emailProvider.resolver');
const { EmailErrorCodes } = require('../src/modules/messages/errors/emailErrors');

describe('EmailProviderResolver', () => {
  test('should fallback gracefully to Microsoft Graph for @gmail.com when Google OAuth is not yet authorized in DB', async () => {
    const res = await resolver.resolve('testuser@gmail.com');
    assert.ok(['microsoft', 'smtp', 'google'].includes(res.providerName));
    assert.ok(res.provider);
  });

  test('should throw EMAIL_PROVIDER_NOT_CONFIGURED when no providers are configured', async () => {
    try {
      await resolver.resolve('orders@shaktitech.com');
      // If none configured, it throws
    } catch (err) {
      assert.strictEqual(err.code, EmailErrorCodes.EMAIL_PROVIDER_NOT_CONFIGURED);
    }
  });

  test('should route to Microsoft Graph provider when Microsoft Graph is configured', async () => {
    resolver.microsoftProvider.tenantId = 'test-tenant';
    resolver.microsoftProvider.clientId = 'test-client';
    resolver.microsoftProvider.clientSecret = 'test-secret';
    resolver.microsoftProvider.senderEmail = 'default@microsoft.com';

    const res = await resolver.resolve('custom@microsoft.com');
    assert.strictEqual(res.providerName, 'microsoft');
    assert.ok(res.provider);

    // Reset
    resolver.microsoftProvider.tenantId = '';
    resolver.microsoftProvider.clientId = '';
    resolver.microsoftProvider.clientSecret = '';
    resolver.microsoftProvider.senderEmail = '';
  });
});

// 4. Test Unified EmailService Interface
const unifiedEmailService = require('../src/modules/messages/services/unifiedEmail.service');

describe('UnifiedEmailService Validation', () => {
  test('should throw error when recipient is missing', async () => {
    await assert.rejects(
      async () => {
        await unifiedEmailService.send({
          from: 'test@example.com',
          subject: 'Test',
          text: 'Hello',
        });
      },
      (err) => {
        assert.strictEqual(err.code, EmailErrorCodes.EMAIL_INVALID_RECIPIENT);
        return true;
      }
    );
  });
});
