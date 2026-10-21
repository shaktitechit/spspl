import { baseApi } from "./baseApi";

export const companyApiSlice = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getCompanyInfo: builder.query<{ success: boolean; data: any }, void>({
      query: () => "/api/company-info",
      providesTags: ["CompanyInfo"],
    }),
    updateCompanyInfo: builder.mutation<{ success: boolean; data: any }, any>({
      query: (body) => ({
        url: "/api/company-info",
        method: "PUT",
        body,
      }),
      invalidatesTags: ["CompanyInfo"],
    }),
  }),
});

export const { useGetCompanyInfoQuery, useUpdateCompanyInfoMutation } = companyApiSlice;
