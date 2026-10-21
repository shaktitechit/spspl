import { medicaApi } from "../baseApi";
import { unwrapEnvelope, type ApiEnvelope } from "../unwrap";
import { PRODUCT_SERVICE_URL } from "@/lib/env";

export type ProductType = "individual" | "kit";

/** Common write fields for create/patch/bulk product payloads. */
export type ProductWriteBody = {
  product_name?: string;
  product_type?: ProductType;
  generic_name?: string | null;
  aliases?: string[];
  sku?: string | null;
  product_group?: string | null;
  product_subgroup?: string | null;
  brand?: string | null;
  manufacturer?: string | null;
  unit?: string;
  base_price?: number;
  minimum_sale_rate?: number;
  mrp?: number | null;
  gst_percent?: number;
  warranty_months?: number;
  description?: string;
  tags?: string[];
  is_active?: boolean;
  is_featured?: boolean;
  [key: string]: unknown;
};

export type ProductListParams = {
  search?: string;
  group?: string;
  status?: string;
  /** Filter featured products: `"true"` | `"false"` | `"all"` */
  is_featured?: string;
  /** Filter by product type: `"individual"` | `"kit"` | `"all"` */
  product_type?: string;
  paginate?: string;
  page?: string;
  limit?: string;
  [key: string]: string | undefined;
};

/** Product Service API — manage catalog + trash. */
export const productsApi = medicaApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (build) => ({
    listProducts: build.query<unknown, ProductListParams | void>({
      query: (params) => ({
        url: `${PRODUCT_SERVICE_URL}/api/products`,
        params: params ?? {},
      }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      providesTags: [{ type: "Products", id: "LIST" }],
    }),
    listProductsDeleted: build.query<
      unknown,
      ProductListParams | void
    >({
      query: (params) => ({
        url: `${PRODUCT_SERVICE_URL}/api/products/deleted`,
        params: params ?? {},
      }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      providesTags: [{ type: "Products", id: "DELETED" }],
    }),
    getProduct: build.query<unknown, string>({
      query: (id) => `${PRODUCT_SERVICE_URL}/api/products/${id}`,
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      providesTags: (_r, _e, id) => [{ type: "Products", id }],
    }),
    getProductMetaOptions: build.query<{
      groups: { _id: string; name: string }[];
      subgroups: { _id: string; name: string; group: string }[];
      brands: { _id: string; name: string }[];
      manufacturers: { _id: string; name: string }[];
    }, void>({
      query: () => `${PRODUCT_SERVICE_URL}/api/products/meta-options`,
      transformResponse: (raw: ApiEnvelope<any>) => unwrapEnvelope(raw),
      providesTags: ["Products"],
    }),
    createProduct: build.mutation<unknown, ProductWriteBody>({
      query: (body) => ({ url: `${PRODUCT_SERVICE_URL}/api/products`, method: "POST", body }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      invalidatesTags: [
        "Products",
        "ProductGroups",
        "ProductSubgroups",
        "ProductBrands",
        "ProductManufacturers",
      ],
    }),
    patchProduct: build.mutation<
      unknown,
      { id: string; patch: ProductWriteBody }
    >({
      query: ({ id, patch }) => ({
        url: `${PRODUCT_SERVICE_URL}/api/products/${id}`,
        method: "PATCH",
        body: patch,
      }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      invalidatesTags: (_r, _e, arg) => [
        "Products",
        { type: "Products", id: arg.id },
        "ProductGroups",
        "ProductSubgroups",
        "ProductBrands",
        "ProductManufacturers",
      ],
    }),
    deleteProduct: build.mutation<unknown, string>({
      query: (id) => ({ url: `${PRODUCT_SERVICE_URL}/api/products/${id}`, method: "DELETE" }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      invalidatesTags: (_r, _e, id) => [
        "Products",
        { type: "Products", id },
        { type: "Products", id: "LIST" },
        { type: "Products", id: "DELETED" },
      ],
    }),
    restoreProduct: build.mutation<unknown, string>({
      query: (id) => ({ url: `${PRODUCT_SERVICE_URL}/api/products/${id}/restore`, method: "POST" }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      invalidatesTags: (_r, _e, id) => [
        "Products",
        { type: "Products", id },
        { type: "Products", id: "LIST" },
        { type: "Products", id: "DELETED" },
      ],
    }),
    bulkCreateProduct: build.mutation<unknown, ProductWriteBody[]>({
      query: (body) => ({
        url: `${PRODUCT_SERVICE_URL}/api/products/bulk`,
        method: "POST",
        body,
      }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      invalidatesTags: [
        "Products",
        "ProductGroups",
        "ProductSubgroups",
        "ProductBrands",
        "ProductManufacturers",
      ],
    }),
    bulkDeleteProducts: build.mutation<unknown, string[]>({
      query: (ids) => ({
        url: `${PRODUCT_SERVICE_URL}/api/products/bulk-delete`,
        method: "POST",
        body: { ids },
      }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      invalidatesTags: ["Products"],
    }),
  }),
});

export const {
  useListProductsQuery,
  useLazyListProductsQuery,
  useListProductsDeletedQuery,
  useLazyListProductsDeletedQuery,
  useGetProductQuery,
  useLazyGetProductQuery,
  useGetProductMetaOptionsQuery,
  useLazyGetProductMetaOptionsQuery,
  useCreateProductMutation,
  usePatchProductMutation,
  useDeleteProductMutation,
  useRestoreProductMutation,
  useBulkCreateProductMutation,
  useBulkDeleteProductsMutation,
} = productsApi;

export const useGetProductsQuery = useListProductsQuery;
export const useGetProductByIdQuery = useGetProductQuery;
export const useLazyGetProductByIdQuery = useLazyGetProductQuery;
