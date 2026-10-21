/**
 * @fileoverview Central service for managing and enforcing User Email Notification Preferences.
 * Checks whether an email type is permitted before sending individual or CC emails.
 * @module services/emailPreference.service
 */

const { getModels } = require('../data/mongoRegistry');
const { DEFAULT_PREFERENCES } = require('../models/UserEmailPreference');
const { logger } = require('../utils/logger');

// Mandatory email types that can never be disabled for security / system reasons
const MANDATORY_EMAIL_TYPES = new Set([
  'auth_password_reset',
  'auth_account_welcome',
  'security_alert',
]);

/**
 * Retrieves preferences for a user, filling in defaults for any missing keys.
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @returns {Promise<object>}
 */
async function getUserEmailPreferences(userId) {
  try {
    const { UserEmailPreference } = getModels();
    const strUserId = String(userId);

    const doc = await UserEmailPreference.findOne({ user: strUserId }).lean();
    if (!doc) {
      return {
        user: strUserId,
        ...DEFAULT_PREFERENCES,
      };
    }

    // Merge with defaults to ensure all keys are present even if schema expanded
    return {
      ...DEFAULT_PREFERENCES,
      ...doc,
      user: strUserId,
    };
  } catch (err) {
    logger.error(`[EmailPreference] Failed to fetch preferences for user ${userId}: ${err.message}`);
    return {
      user: String(userId),
      ...DEFAULT_PREFERENCES,
    };
  }
}

/**
 * Updates email preferences for a user.
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {object} payload
 * @returns {Promise<object>}
 */
async function updateUserEmailPreferences(userId, payload = {}) {
  try {
    const { UserEmailPreference } = getModels();
    const strUserId = String(userId);

    // Filter payload to only allowed boolean preference keys
    const updateData = {};
    for (const key of Object.keys(DEFAULT_PREFERENCES)) {
      if (payload[key] !== undefined) {
        updateData[key] = Boolean(payload[key]);
      }
    }

    const updatedDoc = await UserEmailPreference.findOneAndUpdate(
      { user: strUserId },
      { $set: updateData },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    return {
      ...DEFAULT_PREFERENCES,
      ...updatedDoc,
      user: strUserId,
    };
  } catch (err) {
    logger.error(`[EmailPreference] Failed to update preferences for user ${userId}: ${err.message}`);
    throw err;
  }
}

/**
 * Resets preferences to factory defaults for a user.
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @returns {Promise<object>}
 */
async function resetUserEmailPreferences(userId) {
  try {
    const { UserEmailPreference } = getModels();
    const strUserId = String(userId);

    const updatedDoc = await UserEmailPreference.findOneAndUpdate(
      { user: strUserId },
      { $set: DEFAULT_PREFERENCES },
      { new: true, upsert: true }
    ).lean();

    return {
      ...DEFAULT_PREFERENCES,
      ...updatedDoc,
      user: strUserId,
    };
  } catch (err) {
    logger.error(`[EmailPreference] Failed to reset preferences for user ${userId}: ${err.message}`);
    throw err;
  }
}

/**
 * Checks if a specific email type is allowed to be sent to a user.
 *
 * @param {string|mongoose.Types.ObjectId|object} userOrEmail - User ID, User object, or email address
 * @param {string} emailTypeKey - Key defined in DEFAULT_PREFERENCES
 * @returns {Promise<boolean>}
 */
async function isEmailAllowedForUser(userOrEmail, emailTypeKey) {
  try {
    if (!userOrEmail) return false;
    if (MANDATORY_EMAIL_TYPES.has(emailTypeKey)) return true;

    const { User, UserEmailPreference } = getModels();
    let targetUserId = null;

    if (typeof userOrEmail === 'object' && userOrEmail !== null) {
      targetUserId = userOrEmail._id || userOrEmail.id || null;
    } else if (typeof userOrEmail === 'string') {
      if (userOrEmail.includes('@')) {
        const userDoc = await User.findOne({
          email: userOrEmail.toLowerCase().trim(),
        })
          .select('_id')
          .lean();
        if (userDoc) {
          targetUserId = userDoc._id;
        } else {
          // Unregistered external email address — default to allowing
          return true;
        }
      } else {
        targetUserId = userOrEmail;
      }
    }

    if (!targetUserId) return true;

    const pref = await UserEmailPreference.findOne({ user: targetUserId }).lean();
    if (!pref) {
      // Default is enabled for all types
      return true;
    }

    // 1. Check Master Switch
    if (pref.master_email_enabled === false) {
      return false;
    }

    // 2. Check Specific Email Type Switch
    if (pref[emailTypeKey] === false) {
      return false;
    }

    return true;
  } catch (err) {
    logger.warn(`[EmailPreference] Error checking permission for ${userOrEmail} on ${emailTypeKey}: ${err.message}`);
    // Fail open so critical operational emails are not swallowed on errors
    return true;
  }
}

/**
 * Filters a list of CC email addresses to only include those users who have
 * enabled notifications for the given email type.
 *
 * @param {string[]} ccEmails - Array of email strings
 * @param {string} emailTypeKey - Key defined in DEFAULT_PREFERENCES
 * @returns {Promise<string[]>}
 */
async function filterAllowedCcEmails(ccEmails = [], emailTypeKey) {
  if (!Array.isArray(ccEmails) || ccEmails.length === 0) return [];
  if (MANDATORY_EMAIL_TYPES.has(emailTypeKey)) return ccEmails;

  const allowedList = [];
  for (const email of ccEmails) {
    if (!email || !String(email).trim()) continue;
    const allowed = await isEmailAllowedForUser(email.trim(), emailTypeKey);
    if (allowed) {
      allowedList.push(email.trim());
    } else {
      logger.info(`[EmailPreference] CC recipient ${email} opted out of ${emailTypeKey} emails — omitting.`);
    }
  }

  return allowedList;
}

module.exports = {
  getUserEmailPreferences,
  updateUserEmailPreferences,
  resetUserEmailPreferences,
  isEmailAllowedForUser,
  filterAllowedCcEmails,
  DEFAULT_PREFERENCES,
  MANDATORY_EMAIL_TYPES,
};
