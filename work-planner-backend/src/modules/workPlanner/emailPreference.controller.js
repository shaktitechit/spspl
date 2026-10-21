/**
 * @fileoverview Controller for User Email Notification Preferences.
 * @module modules/workPlanner/emailPreference.controller
 */

const asyncHandler = require('../../utils/asyncHandler');
const {
  getUserEmailPreferences,
  updateUserEmailPreferences,
  resetUserEmailPreferences,
} = require('../../services/emailPreference.service');
const { ApiError } = require('../../utils/ApiError');

function getUserId(user) {
  if (!user) return null;
  return user._id || user.id || user.userId || user.sub || null;
}

exports.getMyEmailPreferences = asyncHandler(async (req, res) => {
  const currentUserId = getUserId(req.user);
  if (!currentUserId) {
    throw new ApiError(401, 'Authentication required');
  }

  const data = await getUserEmailPreferences(currentUserId);
  res.json({ success: true, data });
});

exports.updateMyEmailPreferences = asyncHandler(async (req, res) => {
  const currentUserId = getUserId(req.user);
  if (!currentUserId) {
    throw new ApiError(401, 'Authentication required');
  }

  const data = await updateUserEmailPreferences(currentUserId, req.body || {});
  res.json({ success: true, message: 'Email preferences updated successfully', data });
});

exports.resetMyEmailPreferences = asyncHandler(async (req, res) => {
  const currentUserId = getUserId(req.user);
  if (!currentUserId) {
    throw new ApiError(401, 'Authentication required');
  }

  const data = await resetUserEmailPreferences(currentUserId);
  res.json({ success: true, message: 'Email preferences reset to defaults', data });
});
