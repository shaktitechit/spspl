import { medicaApi } from "../baseApi";
import { unwrapEnvelope, type ApiEnvelope } from "../unwrap";

export type ProductUnitRecord = {
  _id: string;
  name: string;
  description?: string;
  is_default?: boolean;
  is_active: boolean;
  is_featured?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export const productUnitsApi = medicaApi.injectEndpoints({
  endpoints: (build) => ({
    listProductUnits: build.query<
      { data: ProductUnitRecord[]; total: number; page: number; limit: number; pages: number },
      Record<string, string | number | undefined> | void
    >({
      query: (params) => ({
        url: "product-units",
        params: params ?? {},
      }),
      transformResponse: (raw: ApiEnvelope<any>) => unwrapEnvelope(raw),
      providesTags: [{ type: "ProductUnits", id: "LIST" }],
    }),
    getProductUnit: build.query<ProductUnitRecord, string>({
      query: (id) => `product-units/${id}`,
      transformResponse: (raw: ApiEnvelope<ProductUnitRecord>) =>
        unwrapEnvelope(raw) as ProductUnitRecord,
      providesTags: (_r, _e, id) => [{ type: "ProductUnits", id }],
    }),
    createProductUnit: build.mutation<ProductUnitRecord, Partial<ProductUnitRecord>>({
      query: (body) => ({ url: "product-units", method: "POST", body }),
      transformResponse: (raw: ApiEnvelope<ProductUnitRecord>) =>
        unwrapEnvelope(raw) as ProductUnitRecord,
      invalidatesTags: [{ type: "ProductUnits", id: "LIST" }, "Products"],
    }),
    patchProductUnit: build.mutation<
      ProductUnitRecord,
      { id: string; patch: Partial<ProductUnitRecord> }
    >({
      query: ({ id, patch }) => ({
        url: `product-units/${id}`,
        method: "PATCH",
        body: patch,
      }),
      transformResponse: (raw: ApiEnvelope<ProductUnitRecord>) =>
        unwrapEnvelope(raw) as ProductUnitRecord,
      invalidatesTags: (_r, _e, arg) => [
        "ProductUnits",
        { type: "ProductUnits", id: arg.id },
        { type: "ProductUnits", id: "LIST" },
        "Products",
      ],
    }),
    deleteProductUnit: build.mutation<{ success: boolean }, string>({
      query: (id) => ({ url: `product-units/${id}`, method: "DELETE" }),
      transformResponse: (raw: ApiEnvelope<any>) => unwrapEnvelope(raw),
      invalidatesTags: (_r, _e, id) => [
        "ProductUnits",
        { type: "ProductUnits", id },
        { type: "ProductUnits", id: "LIST" },
        "Products",
      ],
    }),
  }),
});

export const {
  useListProductUnitsQuery,
  useCreateProductUnitMutation,
  usePatchProductUnitMutation,
  useDeleteProductUnitMutation,
} = productUnitsApi;
