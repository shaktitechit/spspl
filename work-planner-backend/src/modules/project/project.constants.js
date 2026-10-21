/**
 * @fileoverview Project Management Constants and Helper Roles.
 * @module modules/project/project.constants
 */

const PROJECT_STATUS = {
  DRAFT: 'draft',
  PLANNING: 'planning',
  ACTIVE: 'active',
  ON_HOLD: 'on_hold',
  COMPLETED: 'completed',
  CLOSED: 'closed',
  CANCELLED: 'cancelled',
};

const PROJECT_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

const STEP_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  UNDER_REVIEW: 'under_review',
  COMPLETED: 'completed',
  BLOCKED: 'blocked',
  SKIPPED: 'skipped',
};

const PROJECT_ROLES = {
  ADMIN: 'admin',
  LEAD: 'lead',
  COORDINATOR: 'coordinator',
  CONTRIBUTOR: 'contributor',
  VIEWER: 'viewer',
};

module.exports = {
  PROJECT_STATUS,
  PROJECT_PRIORITY,
  STEP_STATUS,
  PROJECT_ROLES,
};
