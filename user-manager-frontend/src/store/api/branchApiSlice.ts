import { baseApi } from "./baseApi";

export interface BranchBankingRecord {
  _id?: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  ifsc_code: string;
  branch_name: string;
  account_type?: string;
  upi_id?: string;
  swift_code?: string;
  is_primary?: boolean;
}

export interface BranchRecord {
  _id?: string;
  company_id?: string;
  branch_code: string;
  branch_name: string;
  branch_type: "head_office" | "regional_office" | "warehouse" | "retail_depot" | "manufacturing_unit";
  is_head_office: boolean;
  is_active: boolean;
  address: {
    street: string;
    landmark?: string;
    city: string;
    state: string;
    state_code?: string;
    pincode: string;
    country: string;
    currency: string;
    timezone: string;
    financial_year?: string;
  };
  taxation: {
    gstin: string;
    pan: string;
    cin: string;
    drug_license?: string;
    fssai_license?: string;
    invoice_footer_note?: string;
  };
  contact: {
    manager_name: string;
    email: string;
    billing_email?: string;
    phone: string;
    alternate_phone?: string;
    website?: string;
  };
  banking: BranchBankingRecord[];
  invoicing?: {
    invoice_prefix?: string;
    challan_prefix?: string;
    quotation_prefix?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export const branchApiSlice = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getBranches: builder.query<{ success: boolean; data: BranchRecord[] }, { include_inactive?: boolean; search?: string } | void>({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params && params.include_inactive) queryParams.set("include_inactive", "true");
        if (params && params.search) queryParams.set("search", params.search);
        const qs = queryParams.toString();
        return `/branches${qs ? `?${qs}` : ""}`;
      },
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map(({ _id }) => ({ type: "Branch" as const, id: _id })),
              { type: "Branch", id: "LIST" },
            ]
          : [{ type: "Branch", id: "LIST" }],
    }),

    getBranchById: builder.query<{ success: boolean; data: BranchRecord }, string>({
      query: (id) => `/branches/${id}`,
      providesTags: (_res, _err, id) => [{ type: "Branch", id }],
    }),

    createBranch: builder.mutation<{ success: boolean; data: BranchRecord }, Partial<BranchRecord>>({
      query: (body) => ({
        url: "/branches",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "Branch", id: "LIST" }, "CompanyInfo"],
    }),

    updateBranch: builder.mutation<{ success: boolean; data: BranchRecord }, { id: string; body: Partial<BranchRecord> }>({
      query: ({ id, body }) => ({
        url: `/branches/${id}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: (_res, _err, { id }) => [{ type: "Branch", id }, { type: "Branch", id: "LIST" }, "CompanyInfo"],
    }),

    setHeadOffice: builder.mutation<{ success: boolean; data: BranchRecord }, string>({
      query: (id) => ({
        url: `/branches/${id}/set-head-office`,
        method: "POST",
      }),
      invalidatesTags: [{ type: "Branch", id: "LIST" }, "CompanyInfo"],
    }),

    deleteBranch: builder.mutation<{ success: boolean; message: string }, string>({
      query: (id) => ({
        url: `/branches/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "Branch", id: "LIST" }],
    }),
  }),
});

export const {
  useGetBranchesQuery,
  useGetBranchByIdQuery,
  useCreateBranchMutation,
  useUpdateBranchMutation,
  useSetHeadOfficeMutation,
  useDeleteBranchMutation,
} = branchApiSlice;
