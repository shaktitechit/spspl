import { medicaApi } from "../baseApi";
import { unwrapEnvelope, type ApiEnvelope } from "../unwrap";
import { PRODUCT_SERVICE_URL } from "@/lib/env";

export type ProductType = "individual" | "kit";

export type ProductGroupRecord = {
  _id: string;
  name: string;
  description?: string;
  is_active: boolean;
  is_featured?: boolean;
  show_in_unbilled_order_list?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type ProductSubgroupRecord = {
  _id: string;
  name: string;
  group: string | { _id: string; name: string };
  description?: string;
  is_active: boolean;
  is_featured?: boolean;
  show_in_unbilled_order_list?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type ProductBrandRecord = {
  _id: string;
  name: string;
  description?: string;
  is_active: boolean;
  is_featured?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type ProductManufacturerRecord = {
  _id: string;
  name: string;
  description?: string;
  is_active: boolean;
  is_featured?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

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
      units?: { _id: string; name: string; is_default?: boolean }[];
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
    listProductGroups: build.query<
      { data: ProductGroupRecord[]; total: number; page: number; limit: number; pages: number },
      Record<string, string | number | undefined> | void
    >({
      query: (params) => ({
        url: `${PRODUCT_SERVICE_URL}/api/product-groups`,
        params: params ?? {},
      }),
      transformResponse: (raw: ApiEnvelope<any>) => unwrapEnvelope(raw),
      providesTags: [{ type: "ProductGroups", id: "LIST" }],
    }),
    getProductGroup: build.query<ProductGroupRecord, string>({
      query: (id) => `${PRODUCT_SERVICE_URL}/api/product-groups/${id}`,
      transformResponse: (raw: ApiEnvelope<ProductGroupRecord>) =>
        unwrapEnvelope(raw) as ProductGroupRecord,
      providesTags: (_r, _e, id) => [{ type: "ProductGroups", id }],
    }),
    createProductGroup: build.mutation<ProductGroupRecord, Partial<ProductGroupRecord>>({
      query: (body) => ({
        url: `${PRODUCT_SERVICE_URL}/api/product-groups`,
        method: "POST",
        body,
      }),
      transformResponse: (raw: ApiEnvelope<ProductGroupRecord>) =>
        unwrapEnvelope(raw) as ProductGroupRecord,
      invalidatesTags: [{ type: "ProductGroups", id: "LIST" }, "Products"],
    }),
    patchProductGroup: build.mutation<
      ProductGroupRecord,
      { id: string; patch: Partial<ProductGroupRecord> }
    >({
      query: ({ id, patch }) => ({
        url: `${PRODUCT_SERVICE_URL}/api/product-groups/${id}`,
        method: "PATCH",
        body: patch,
      }),
      transformResponse: (raw: ApiEnvelope<ProductGroupRecord>) =>
        unwrapEnvelope(raw) as ProductGroupRecord,
      invalidatesTags: (_r, _e, arg) => [
        "ProductGroups",
        { type: "ProductGroups", id: arg.id },
        { type: "ProductGroups", id: "LIST" },
        "Products",
      ],
    }),
    listProductSubgroups: build.query<
      { data: ProductSubgroupRecord[]; total: number; page: number; limit: number; pages: number },
      Record<string, string | number | undefined> | void
    >({
      query: (params) => ({
        url: `${PRODUCT_SERVICE_URL}/api/product-subgroups`,
        params: params ?? {},
      }),
      transformResponse: (raw: ApiEnvelope<any>) => unwrapEnvelope(raw),
      providesTags: [{ type: "ProductSubgroups", id: "LIST" }],
    }),
    getProductSubgroup: build.query<ProductSubgroupRecord, string>({
      query: (id) => `${PRODUCT_SERVICE_URL}/api/product-subgroups/${id}`,
      transformResponse: (raw: ApiEnvelope<ProductSubgroupRecord>) =>
        unwrapEnvelope(raw) as ProductSubgroupRecord,
      providesTags: (_r, _e, id) => [{ type: "ProductSubgroups", id }],
    }),
    createProductSubgroup: build.mutation<ProductSubgroupRecord, Partial<ProductSubgroupRecord>>({
      query: (body) => ({
        url: `${PRODUCT_SERVICE_URL}/api/product-subgroups`,
        method: "POST",
        body,
      }),
      transformResponse: (raw: ApiEnvelope<ProductSubgroupRecord>) =>
        unwrapEnvelope(raw) as ProductSubgroupRecord,
      invalidatesTags: [{ type: "ProductSubgroups", id: "LIST" }, "Products"],
    }),
    patchProductSubgroup: build.mutation<
      ProductSubgroupRecord,
      { id: string; patch: Partial<ProductSubgroupRecord> }
    >({
      query: ({ id, patch }) => ({
        url: `${PRODUCT_SERVICE_URL}/api/product-subgroups/${id}`,
        method: "PATCH",
        body: patch,
      }),
      transformResponse: (raw: ApiEnvelope<ProductSubgroupRecord>) =>
        unwrapEnvelope(raw) as ProductSubgroupRecord,
      invalidatesTags: (_r, _e, arg) => [
        "ProductSubgroups",
        { type: "ProductSubgroups", id: arg.id },
        { type: "ProductSubgroups", id: "LIST" },
        "Products",
      ],
    }),
    listProductBrands: build.query<
      { data: ProductBrandRecord[]; total: number; page: number; limit: number; pages: number },
      Record<string, string | number | undefined> | void
    >({
      query: (params) => ({
        url: `${PRODUCT_SERVICE_URL}/api/product-brands`,
        params: params ?? {},
      }),
      transformResponse: (raw: ApiEnvelope<any>) => unwrapEnvelope(raw),
      providesTags: [{ type: "ProductBrands", id: "LIST" }],
    }),
    getProductBrand: build.query<ProductBrandRecord, string>({
      query: (id) => `${PRODUCT_SERVICE_URL}/api/product-brands/${id}`,
      transformResponse: (raw: ApiEnvelope<ProductBrandRecord>) =>
        unwrapEnvelope(raw) as ProductBrandRecord,
      providesTags: (_r, _e, id) => [{ type: "ProductBrands", id }],
    }),
    createProductBrand: build.mutation<ProductBrandRecord, Partial<ProductBrandRecord>>({
      query: (body) => ({
        url: `${PRODUCT_SERVICE_URL}/api/product-brands`,
        method: "POST",
        body,
      }),
      transformResponse: (raw: ApiEnvelope<ProductBrandRecord>) =>
        unwrapEnvelope(raw) as ProductBrandRecord,
      invalidatesTags: [{ type: "ProductBrands", id: "LIST" }, "Products"],
    }),
    patchProductBrand: build.mutation<
      ProductBrandRecord,
      { id: string; patch: Partial<ProductBrandRecord> }
    >({
      query: ({ id, patch }) => ({
        url: `${PRODUCT_SERVICE_URL}/api/product-brands/${id}`,
        method: "PATCH",
        body: patch,
      }),
      transformResponse: (raw: ApiEnvelope<ProductBrandRecord>) =>
        unwrapEnvelope(raw) as ProductBrandRecord,
      invalidatesTags: (_r, _e, arg) => [
        "ProductBrands",
        { type: "ProductBrands", id: arg.id },
        { type: "ProductBrands", id: "LIST" },
        "Products",
      ],
    }),
    listProductManufacturers: build.query<
      { data: ProductManufacturerRecord[]; total: number; page: number; limit: number; pages: number },
      Record<string, string | number | undefined> | void
    >({
      query: (params) => ({
        url: `${PRODUCT_SERVICE_URL}/api/product-manufacturers`,
        params: params ?? {},
      }),
      transformResponse: (raw: ApiEnvelope<any>) => unwrapEnvelope(raw),
      providesTags: [{ type: "ProductManufacturers", id: "LIST" }],
    }),
    getProductManufacturer: build.query<ProductManufacturerRecord, string>({
      query: (id) => `${PRODUCT_SERVICE_URL}/api/product-manufacturers/${id}`,
      transformResponse: (raw: ApiEnvelope<ProductManufacturerRecord>) =>
        unwrapEnvelope(raw) as ProductManufacturerRecord,
      providesTags: (_r, _e, id) => [{ type: "ProductManufacturers", id }],
    }),
    createProductManufacturer: build.mutation<
      ProductManufacturerRecord,
      Partial<ProductManufacturerRecord>
    >({
      query: (body) => ({
        url: `${PRODUCT_SERVICE_URL}/api/product-manufacturers`,
        method: "POST",
        body,
      }),
      transformResponse: (raw: ApiEnvelope<ProductManufacturerRecord>) =>
        unwrapEnvelope(raw) as ProductManufacturerRecord,
      invalidatesTags: [{ type: "ProductManufacturers", id: "LIST" }, "Products"],
    }),
    patchProductManufacturer: build.mutation<
      ProductManufacturerRecord,
      { id: string; patch: Partial<ProductManufacturerRecord> }
    >({
      query: ({ id, patch }) => ({
        url: `${PRODUCT_SERVICE_URL}/api/product-manufacturers/${id}`,
        method: "PATCH",
        body: patch,
      }),
      transformResponse: (raw: ApiEnvelope<ProductManufacturerRecord>) =>
        unwrapEnvelope(raw) as ProductManufacturerRecord,
      invalidatesTags: (_r, _e, arg) => [
        "ProductManufacturers",
        { type: "ProductManufacturers", id: arg.id },
        { type: "ProductManufacturers", id: "LIST" },
        "Products",
      ],
    }),
    listProductUnits: build.query<
      { data: ProductUnitRecord[]; total: number; page: number; limit: number; pages: number },
      Record<string, string | number | undefined> | void
    >({
      query: (params) => ({
        url: `${PRODUCT_SERVICE_URL}/api/product-units`,
        params: params ?? {},
      }),
      transformResponse: (raw: ApiEnvelope<any>) => unwrapEnvelope(raw),
      providesTags: [{ type: "ProductUnits", id: "LIST" }],
    }),
    getProductUnit: build.query<ProductUnitRecord, string>({
      query: (id) => `${PRODUCT_SERVICE_URL}/api/product-units/${id}`,
      transformResponse: (raw: ApiEnvelope<ProductUnitRecord>) =>
        unwrapEnvelope(raw) as ProductUnitRecord,
      providesTags: (_r, _e, id) => [{ type: "ProductUnits", id }],
    }),
    createProductUnit: build.mutation<ProductUnitRecord, Partial<ProductUnitRecord>>({
      query: (body) => ({
        url: `${PRODUCT_SERVICE_URL}/api/product-units`,
        method: "POST",
        body,
      }),
      transformResponse: (raw: ApiEnvelope<ProductUnitRecord>) =>
        unwrapEnvelope(raw) as ProductUnitRecord,
      invalidatesTags: [{ type: "ProductUnits", id: "LIST" }, "Products"],
    }),
    patchProductUnit: build.mutation<
      ProductUnitRecord,
      { id: string; patch: Partial<ProductUnitRecord> }
    >({
      query: ({ id, patch }) => ({
        url: `${PRODUCT_SERVICE_URL}/api/product-units/${id}`,
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
  useListProductGroupsQuery,
  useGetProductGroupQuery,
  useCreateProductGroupMutation,
  usePatchProductGroupMutation,
  useListProductSubgroupsQuery,
  useGetProductSubgroupQuery,
  useCreateProductSubgroupMutation,
  usePatchProductSubgroupMutation,
  useListProductBrandsQuery,
  useGetProductBrandQuery,
  useCreateProductBrandMutation,
  usePatchProductBrandMutation,
  useListProductManufacturersQuery,
  useGetProductManufacturerQuery,
  useCreateProductManufacturerMutation,
  usePatchProductManufacturerMutation,
  useListProductUnitsQuery,
  useGetProductUnitQuery,
  useCreateProductUnitMutation,
  usePatchProductUnitMutation,
} = productsApi;

export const useGetProductsQuery = useListProductsQuery;
export const useGetProductByIdQuery = useGetProductQuery;
export const useLazyGetProductByIdQuery = useLazyGetProductQuery;
