/**
 * @fileoverview Shared constants (roles) — OPMS portal access_roles.
 * @module constants/roles
 */
const SUPER_ADMIN = 'super_admin';
const ADMIN = 'admin';
const SALES = 'sales';
const FINANCE = 'finance';
const DISPATCH = 'dispatch';
const ACCOUNT = 'account';

module.exports = {
  SUPER_ADMIN,
  ADMIN,
  SALES,
  FINANCE,
  DISPATCH,
  ACCOUNT,
  /** Catalog of valid OPMS portal access_roles. */
  OPMS_ACCESS_ROLES: Object.freeze([
    SUPER_ADMIN,
    ADMIN,
    SALES,
    FINANCE,
    ACCOUNT,
    DISPATCH,
  ]),
};
