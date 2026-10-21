import { baseApi } from "./baseApi";
import type { DepartmentItem } from "@/types/userManager";

export const departmentApiSlice = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDepartments: builder.query<DepartmentItem[], void>({
      query: () => "/api/departments",
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ _id, id }) => ({ type: "Department" as const, id: _id || id })),
              { type: "Department", id: "LIST" },
            ]
          : [{ type: "Department", id: "LIST" }],
    }),
    createDepartment: builder.mutation<DepartmentItem, Partial<DepartmentItem>>({
      query: (body) => ({
        url: "/api/departments",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "Department", id: "LIST" }],
    }),
    updateDepartment: builder.mutation<DepartmentItem, { id: string; data: Partial<DepartmentItem> }>({
      query: ({ id, data }) => ({
        url: `/api/departments/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Department", id },
        { type: "Department", id: "LIST" },
      ],
    }),
    deleteDepartment: builder.mutation<void, string>({
      query: (id) => ({
        url: `/api/departments/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "Department", id: "LIST" }],
    }),
  }),
});

export const {
  useGetDepartmentsQuery,
  useCreateDepartmentMutation,
  useUpdateDepartmentMutation,
  useDeleteDepartmentMutation,
} = departmentApiSlice;
