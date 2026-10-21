import { medicaApi } from "../baseApi";
import { unwrapEnvelope, type ApiEnvelope } from "../unwrap";

export type CompanyInfoRecord = {
  _id?: string;
  legal_name: string;
  trade_name: string;
  gstin: string;
  cin: string;
  pan: string;
  drug_license: string;
  fssai_license: string;
  email: string;
  billing_email: string;
  phone: string;
  website: string;
  logo_url: string;
  favicon_url: string;
  primary_color?: string;
  secondary_color?: string;
  theme_palette?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  currency: string;
  timezone: string;
  financial_year: string;
  invoice_footer_note: string;
  bank_name?: string;
  account_name?: string;
  account_number?: string;
  ifsc_code?: string;
  branch_name?: string;
  account_type?: string;
  upi_id?: string;
  swift_code?: string;
  is_default?: boolean;
  updated_by?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type CompanyAggregatedData = {
  company_info: CompanyInfoRecord;
  metrics: {
    users: {
      total: number;
      active: number;
      departments: {
        super_admin: number;
        admin: number;
        sales: number;
        finance: number;
        account: number;
        dispatch: number;
      };
    };
    parties: {
      total: number;
      active: number;
      by_type: {
        customer: number;
        supplier: number;
        both: number;
      };
    };
    catalog: {
      total_products: number;
      active_products: number;
      total_groups: number;
      total_brands: number;
      total_manufacturers: number;
    };
    orders: {
      total: number;
      total_revenue: number;
      by_status: Record<string, number>;
      recent: Array<{
        _id: string;
        order_no: string;
        total_amount: number;
        status: string;
        order_date?: string;
        createdAt?: string;
      }>;
    };
    fleet: {
      vehicles: number;
      drivers: number;
      transport_agents: number;
      active_transport_plans: number;
    };
    field_operations: {
      work_plans: number;
      visits: number;
      total_expenses: number;
    };
    financials: {
      total_due_sheets: number;
      unbilled_orders: number;
      estimated_revenue: number;
    };
    recent_activity: Array<{
      _id: string;
      action: string;
      entity_type?: string;
      details?: string;
      createdAt?: string;
      actor?: {
        name?: string;
        email?: string;
        department?: string;
      };
    }>;
  };
};

export type BranchBankingRecord = {
  _id?: string;
  bank_name?: string;
  account_name?: string;
  account_number?: string;
  ifsc_code?: string;
  branch_name?: string;
  account_type?: string;
  upi_id?: string;
  swift_code?: string;
  is_primary?: boolean;
};

export type BranchAddressRecord = {
  street?: string;
  landmark?: string;
  city?: string;
  state?: string;
  state_code?: string;
  pincode?: string;
  country?: string;
  currency?: string;
  timezone?: string;
  financial_year?: string;
};

export type BranchTaxationRecord = {
  gstin?: string;
  pan?: string;
  cin?: string;
  drug_license?: string;
  fssai_license?: string;
  invoice_footer_note?: string;
};

export type BranchContactRecord = {
  manager_name?: string;
  email?: string;
  billing_email?: string;
  phone?: string;
  alternate_phone?: string;
  website?: string;
};

export type BranchInvoicingRecord = {
  invoice_prefix?: string;
  challan_prefix?: string;
  quotation_prefix?: string;
};

export type BranchRecord = {
  _id: string;
  company_id?: string;
  branch_code: string;
  branch_name: string;
  branch_type?: string;
  is_head_office?: boolean;
  is_active?: boolean;
  address?: BranchAddressRecord;
  taxation?: BranchTaxationRecord;
  contact?: BranchContactRecord;
  banking?: BranchBankingRecord[];
  invoicing?: BranchInvoicingRecord;
  createdAt?: string;
  updatedAt?: string;
};

/** `/api/company-info` & `/api/branches` — Company Information, Branches & Organization Settings suite. */
export const companyInfoApi = medicaApi.injectEndpoints({
  endpoints: (build) => ({
    getCompanyInfo: build.query<CompanyInfoRecord, void>({
      query: () => "company-info",
      transformResponse: (raw: ApiEnvelope<CompanyInfoRecord>) =>
        unwrapEnvelope(raw),
      providesTags: ["CompanyInfo"],
    }),
    getCompanyData: build.query<CompanyAggregatedData, void>({
      query: () => "company-info/data",
      transformResponse: (raw: ApiEnvelope<CompanyAggregatedData>) =>
        unwrapEnvelope(raw),
      providesTags: ["CompanyInfo"],
    }),
    getBranches: build.query<BranchRecord[], void>({
      query: () => "branches",
      transformResponse: (raw: any) => {
        if (!raw) return [];
        if (Array.isArray(raw)) return raw;
        if (Array.isArray(raw.branches)) return raw.branches;
        if (Array.isArray(raw.data)) return raw.data;
        return (unwrapEnvelope(raw) as BranchRecord[]) || [];
      },
      providesTags: ["CompanyInfo"],
    }),
    getHeadOfficeBranch: build.query<BranchRecord, void>({
      query: () => "branches/head-office",
      transformResponse: (raw: any) => {
        if (!raw) return null as any;
        if (raw.branch) return raw.branch;
        if (raw.data) return raw.data;
        return unwrapEnvelope(raw);
      },
      providesTags: ["CompanyInfo"],
    }),
    updateCompanyInfo: build.mutation<
      CompanyInfoRecord,
      Partial<CompanyInfoRecord>
    >({
      query: (patch) => ({
        url: "company-info",
        method: "PATCH",
        body: patch,
      }),
      transformResponse: (raw: ApiEnvelope<CompanyInfoRecord>) =>
        unwrapEnvelope(raw),
      invalidatesTags: ["CompanyInfo"],
    }),
  }),
});

export const {
  useGetCompanyInfoQuery,
  useLazyGetCompanyInfoQuery,
  useGetCompanyDataQuery,
  useLazyGetCompanyDataQuery,
  useGetBranchesQuery,
  useLazyGetBranchesQuery,
  useGetHeadOfficeBranchQuery,
  useUpdateCompanyInfoMutation,
} = companyInfoApi;
