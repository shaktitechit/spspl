/**
 * @fileoverview Unified Email Service.
 * Provides a single unified API to send emails across Microsoft Graph, Gmail API, and SMTP.
 * @module modules/messages/services/unifiedEmail.service
 */
const resolver = require('../providers/emailProvider.resolver');
const { logger } = require('../../../config/logger');
const { EmailError, EmailErrorCodes } = require('../errors/emailErrors');

class UnifiedEmailService {
  /**
   * Universal email sending method.
   *
   * @param {object} params
   * @param {string} [params.from] - Sender email address.
   * @param {string|string[]} params.to - Recipient(s) (can also be passed as `recipient`).
   * @param {string|string[]} [params.recipient] - Alias for `to`.
   * @param {string|string[]} [params.cc] - Carbon copy recipient(s).
   * @param {string|string[]} [params.bcc] - Blind carbon copy recipient(s).
   * @param {string} [params.replyTo] - Reply-To address.
   * @param {string} [params.subject] - Email subject line.
   * @param {string} [params.html] - HTML body content.
   * @param {string} [params.text] - Plain text body content.
   * @param {Array} [params.attachments] - Array of attachment objects [{ filename, content, contentType, path }].
   * @param {string} [params.provider] - Optional explicitly requested provider ('microsoft' | 'google' | 'smtp').
   * @returns {Promise<object>} Result metadata from provider execution.
   */
  async send(params = {}) {
    const {
      from,
      to,
      recipient,
      cc,
      bcc,
      replyTo,
      subject,
      html,
      text,
      attachments = [],
      provider: requestedProvider,
    } = params;

    const toRecipients = to || recipient;
    if (!toRecipients) {
      throw new EmailError(
        EmailErrorCodes.EMAIL_INVALID_RECIPIENT,
        'Recipient (to) is required',
        400
      );
    }

    const startTime = Date.now();
    const recipientCount = Array.isArray(toRecipients)
      ? toRecipients.length
      : String(toRecipients).split(/[,;]/).filter(Boolean).length;

    // 1. Resolve appropriate provider and account credentials
    const { providerName, provider, account } = await resolver.resolve(from, requestedProvider);

    logger.info(
      `[UnifiedEmailService] Routing email "${subject || 'No Subject'}" to provider=${providerName} for ${recipientCount} recipient(s)`
    );

    try {
      const result = await provider.send({
        from,
        to: toRecipients,
        cc,
        bcc,
        replyTo,
        subject,
        html,
        text,
        attachments,
        account,
      });

      const durationMs = Date.now() - startTime;
      logger.info(
        `[UnifiedEmailService] Email sent successfully via provider=${providerName} in ${durationMs}ms (from=${from || result.from || 'default'}, recipients=${recipientCount})`
      );

      return {
        success: true,
        provider: providerName,
        messageId: result.messageId || null,
        from: from || result.from || null,
        durationMs,
        data: result.data || result,
      };
    } catch (err) {
      // If Google failed due to insufficient scopes or auth, and no explicit provider was forced, fallback to Microsoft Graph
      const isAuthOrScopeError =
        err.message?.includes('insufficient authentication scopes') ||
        err.message?.includes('invalid_grant') ||
        err.statusCode === 401 ||
        err.statusCode === 403;

      if (providerName === 'google' && !requestedProvider && isAuthOrScopeError && resolver.microsoftProvider.isConfigured()) {
        logger.warn(
          `[UnifiedEmailService] Google delivery failed for ${from || 'sender'} (${err.message}). Falling back to Microsoft Graph.`
        );
        try {
          const fallbackResult = await resolver.microsoftProvider.send({
            from,
            to: toRecipients,
            cc,
            bcc,
            replyTo,
            subject,
            html,
            text,
            attachments,
            account: null,
          });
          const durationMs = Date.now() - startTime;
          logger.info(
            `[UnifiedEmailService] Email sent successfully via Microsoft Graph fallback in ${durationMs}ms`
          );
          return {
            success: true,
            provider: 'microsoft',
            fallbackFrom: 'google',
            messageId: fallbackResult.messageId || null,
            from: from || fallbackResult.from || null,
            durationMs,
            data: fallbackResult.data || fallbackResult,
          };
        } catch (fallbackErr) {
          logger.error(`[UnifiedEmailService] Fallback to Microsoft Graph also failed: ${fallbackErr.message}`);
        }
      }

      const durationMs = Date.now() - startTime;
      const errorCode = err.code || EmailErrorCodes.EMAIL_SEND_FAILED;

      logger.error(
        `[UnifiedEmailService] Email delivery failed via provider=${providerName} in ${durationMs}ms: [${errorCode}] ${err.message}`
      );

      if (err instanceof EmailError) {
        throw err;
      }

      throw new EmailError(
        errorCode,
        `Email delivery failed via ${providerName}: ${err.message}`,
        err.statusCode || 500,
        { provider: providerName }
      );
    }
  }
}

module.exports = new UnifiedEmailService();
