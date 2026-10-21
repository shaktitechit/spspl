import { TaskTemplateField } from "./userTaskTemplateSettings";

export interface UserVisitTemplateDefinition {
  userIdOrUsername: string;
  templateTitle: string;
  description?: string;

  // Phase 1: Planning / Creation Phase (Scheduled Visit)
  createTemplate: {
    enabled: boolean;
    title: string;
    description?: string;
    fields: TaskTemplateField[];
  };

  // Phase 2: Execution / Outcome Reporting Phase (Post-Visit Debrief)
  outcomeTemplate: {
    enabled: boolean;
    title: string;
    description?: string;
    fields: TaskTemplateField[];
  };

  isConfigured?: boolean;
  updatedAt?: string | null;
}

export const DEFAULT_PRESET_VISIT_TEMPLATE: Omit<UserVisitTemplateDefinition, "userIdOrUsername"> = {
  templateTitle: "Standard Doctor & Chemist Field Visit Template",
  description: "Mandatory pre-call planning and post-call debrief fields applied to all field visits for this user.",
  createTemplate: {
    enabled: true,
    title: "Pre-Visit Planning Details",
    description: "Specify targeted clinical objective and focus products before the call.",
    fields: [
      {
        id: "vf_objective",
        key: "visit_objective",
        label: "Clinical / Commercial Objective",
        type: "text",
        placeholder: "e.g. Introduce Cardiovasc 20mg, address efficacy query",
        isRequired: true,
        wordLimit: 25,
        helpText: "Concise goal for this call (max 25 words).",
      },
      {
        id: "vf_focus_products",
        key: "focus_products_planned",
        label: "Focus Brands to Detail",
        type: "multi-select",
        isRequired: true,
        options: ["CardioVasc 20mg", "GlycoGuard Tab", "OsteoPlus D3", "NeuroVite Forte", "PulmoClear Syrup"],
      },
      {
        id: "vf_prior_followup",
        key: "is_prior_followup",
        label: "Is this a Follow-up from Previous Visit?",
        type: "switch",
        isRequired: false,
        defaultValue: false,
      },
    ],
  },
  outcomeTemplate: {
    enabled: true,
    title: "Post-Call Debrief & Outcome Report",
    description: "Record detailed discussion feedback, samples dispensed, and POB booking.",
    fields: [
      {
        id: "vf_discussion_notes",
        key: "clinical_discussion_notes",
        label: "Doctor / Client Discussion Summary",
        type: "textarea",
        placeholder: "Record doctor's response to product presentation, patient profile discussed...",
        isRequired: true,
        wordLimit: 120,
        helpText: "Detailed debrief for supervisory review (max 120 words).",
      },
      {
        id: "vf_samples_qty",
        key: "samples_dispensed_qty",
        label: "Sample Packs Dispensed (Units)",
        type: "number",
        placeholder: "0",
        isRequired: false,
        min: 0,
        max: 25,
      },
      {
        id: "vf_pob_value",
        key: "pob_order_booking_value",
        label: "Personal Order Booking (POB) Value (₹)",
        type: "currency",
        placeholder: "0",
        isRequired: false,
        min: 0,
      },
      {
        id: "vf_doctor_objection",
        key: "key_objection_raised",
        label: "Primary Objection / Barrier Raised",
        type: "select",
        isRequired: true,
        options: ["None / Highly Receptive", "Price / Patient Affordability", "Competitor Loyalty", "Efficacy / Scientific Data Needed", "Stock Availability at Local Chemist"],
      },
      {
        id: "vf_selfie_proof",
        key: "clinic_photo_proof",
        label: "Clinic / Chemist Front Photo Proof",
        type: "file",
        isRequired: false,
        allowedFileTypes: ["image/*"],
        helpText: "Upload geotagged selfie or prescription slip.",
      },
      {
        id: "vf_relationship_rating",
        key: "doctor_relationship_rating",
        label: "Client Relationship & Reception Rating",
        type: "rating",
        isRequired: false,
        defaultValue: 4,
        max: 5,
      },
      {
        id: "vf_next_visit_date",
        key: "tentative_next_call_date",
        label: "Tentative Next Scheduled Visit Date",
        type: "date",
        isRequired: false,
      },
    ],
  },
  updatedAt: new Date().toISOString(),
};
