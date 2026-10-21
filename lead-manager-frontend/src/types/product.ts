export type ProductType = "individual" | "kit";

export interface ProductRecord {
  _id: string;
  id?: string;
  product_name: string;
  product_type?: ProductType;
  generic_name?: string | null;
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
  description?: string;
  is_active?: boolean;
  is_featured?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductListParams {
  search?: string;
  group?: string;
  subgroup?: string;
  brand?: string;
  manufacturer?: string;
  status?: string;
  is_featured?: string;
  product_type?: string;
  page?: number | string;
  limit?: number | string;
  [key: string]: string | number | boolean | undefined;
}

export interface ProductListResponse {
  success?: boolean;
  data: ProductRecord[] | { items: ProductRecord[]; total: number; page: number; limit: number };
  total?: number;
  page?: number;
  limit?: number;
}
