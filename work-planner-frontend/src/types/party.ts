export interface PartyContact {
  name?: string;
  contact_person?: string;
  phone?: string;
  contact_number?: string;
  email?: string;
  contact_email?: string;
  alternate_phone?: string;
  department?: string;
  designation?: string;
}

export interface PartyRecord {
  _id: string;
  id?: string;
  party_name: string;
  party_type?: string;
  contact_person?: string;
  mobile?: string;
  email?: string;
  gst_no?: string;
  drug_license_no?: string;
  billing_address?: {
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
    [key: string]: unknown;
  };
  shipping_address?: {
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
    [key: string]: unknown;
  };
  district?: string;
  state?: string;
  city?: string;
  country_id?: string;
  state_id?: string;
  city_id?: string;
  contacts?: PartyContact[];
  payment_terms?: string;
  is_active?: boolean;
  is_featured?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PartyCountryRecord {
  _id: string;
  id?: string;
  name: string;
  iso_code?: string;
  phone_code?: string;
  is_active?: boolean;
}

export interface PartyStateRecord {
  _id: string;
  id?: string;
  name: string;
  country?: string | PartyCountryRecord;
  is_active?: boolean;
}

export interface PartyCityRecord {
  _id: string;
  id?: string;
  name: string;
  state?: string | PartyStateRecord;
  is_active?: boolean;
}

export interface PartyListParams {
  search?: string;
  type?: string;
  status?: string;
  is_featured?: string;
  country_id?: string;
  state_id?: string;
  city_id?: string;
  state?: string;
  city?: string;
  page?: number | string;
  limit?: number | string;
  [key: string]: string | number | boolean | undefined;
}

export interface PartyListResponse {
  success?: boolean;
  data: PartyRecord[] | { items: PartyRecord[]; total: number; page: number; limit: number };
  total?: number;
  page?: number;
  limit?: number;
}
