/**
 * Work Planner Component Library
 *
 * Modular architecture organized by separation of work:
 * - plans: Work plans CRUD, forms, calendar, analytics, and plan actions
 * - tasks-visits: Task (work) & visit execution, lifecycle modals, and reports
 * - expenses: Expense recording, settlement vouchers, advances, attachments, reports
 * - day-end: Day-end reporting, summary views, rich editor, email notifications
 * - senior-remarks: Supervisory directives and remarks
 * - settings: Portal, user configuration templates, team management
 * - notes: Quick scratchpad & notes conversion to work plans
 * - shared: Reusable widgets, date filters, PDF/Excel reports, common modals, and utils
 */

export * from "./plans";
export * from "./tasks-visits";
export * from "./expenses";
export * from "./day-end";
export * from "./senior-remarks";
export * from "./settings";
export * from "./notes";
export * from "./shared";

