export type TemplateFieldType =
  | "text"
  | "textarea"
  | "number"
  | "decimal"
  | "currency"
  | "select"
  | "multi-select"
  | "radio"
  | "checkbox"
  | "date"
  | "time"
  | "datetime-local"
  | "file"
  | "url"
  | "rating"
  | "slider"
  | "switch";

export interface TaskTemplateField {
  id: string;
  key: string;
  label: string;
  type: TemplateFieldType;
  placeholder?: string;
  helpText?: string;
  isRequired: boolean;
  defaultValue?: any;
  wordLimit?: number; // Word count limit for text/textarea
  charLimit?: number; // Character count limit
  min?: number; // Min for numbers/sliders
  max?: number; // Max for numbers/sliders
  step?: number;
  options?: string[]; // Options for select, multi-select, radio
  allowedFileTypes?: string[]; // Allowed MIME/extensions for file upload
}

export interface UserTaskDefinition {
  id: string;
  title: string;
  description?: string;
  category?: string;
  isDefault: boolean; // Auto-included in daily plan
  plannedStartTime?: string;
  plannedEndTime?: string;

  // Dynamic template for task creation / planning phase
  createTemplate: {
    enabled: boolean;
    title: string;
    description?: string;
    fields: TaskTemplateField[];
  };

  // Dynamic template for task outcome / completion reporting phase
  outcomeTemplate: {
    enabled: boolean;
    title: string;
    description?: string;
    fields: TaskTemplateField[];
  };

  createdAt: string;
  updatedAt: string;
}

export function countWords(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}
