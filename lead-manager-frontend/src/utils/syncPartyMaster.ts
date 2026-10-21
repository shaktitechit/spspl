import type { PartyItem } from "@/components/leads/PartySearchAutocomplete";
import type { PartyWriteBody } from "@/store/api/slices/partiesApi";

export interface SyncPartyMasterInput {
  partyType: "leads" | "quotation";
  partyId?: string | null;
  partyName: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  gst?: string;
  billingAddress?: {
    address_line_1?: string;
    address_line_2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
    country_id?: string;
    state_id?: string;
    city_id?: string;
  };
  countryId?: string;
  stateId?: string;
  cityId?: string;
  contacts?: Array<{
    name: string;
    department?: string;
    designation?: string;
    phone?: string;
    email?: string;
    alternate_phone?: string;
    is_primary?: boolean;
  }>;
  existingParties: PartyItem[];
  fetchPartiesBySearch?: (query: { search: string; limit?: string }) => Promise<unknown>;
  createParty: (body: PartyWriteBody) => Promise<any>;
  patchParty: (arg: { id: string; patch: PartyWriteBody }) => Promise<any>;
}

export interface SyncPartyMasterResult {
  partyId: string;
  matched: boolean;
  partyName: string;
}

function cleanDigits(val?: string): string {
  return (val || "").replace(/\D/g, "");
}

function matchPartyInList(
  list: PartyItem[],
  criteria: {
    cleanGst: string;
    cleanPhones10: string[];
    cleanEmails: string[];
    cleanName: string;
  }
): PartyItem | null {
  const { cleanGst, cleanPhones10, cleanEmails, cleanName } = criteria;

  // 1. Check GST match
  if (cleanGst && cleanGst.length >= 8) {
    const match = list.find((p) => {
      const pGst = (p.gst_no || "").replace(/\s+/g, "").toUpperCase();
      return pGst && pGst === cleanGst;
    });
    if (match) return match;
  }

  // 2. Check Contact number match across all provided phone numbers
  if (cleanPhones10.length > 0) {
    const match = list.find((p) => {
      const pMob = cleanDigits(p.mobile || p.phone);
      const pMob10 = pMob.length >= 10 ? pMob.slice(-10) : pMob;
      if (pMob10 && cleanPhones10.includes(pMob10)) return true;

      if (Array.isArray(p.contacts)) {
        return p.contacts.some((c) => {
          const cPhone = cleanDigits(c.phone || c.alternate_phone);
          const cPhone10 = cPhone.length >= 10 ? cPhone.slice(-10) : cPhone;
          return cPhone10 && cleanPhones10.includes(cPhone10);
        });
      }
      return false;
    });
    if (match) return match;
  }

  // 3. Check Email match across all provided emails
  if (cleanEmails.length > 0) {
    const match = list.find((p) => {
      const pEmail = (p.email || "").trim().toLowerCase();
      if (pEmail && cleanEmails.includes(pEmail)) return true;

      if (Array.isArray(p.contacts)) {
        return p.contacts.some((c) => {
          const cEmail = (c.email || "").trim().toLowerCase();
          return cEmail && cleanEmails.includes(cEmail);
        });
      }
      return false;
    });
    if (match) return match;
  }

  // 4. Check Company / Party name match (exact case-insensitive)
  if (cleanName) {
    const match = list.find(
      (p) => (p.party_name || "").trim().toLowerCase() === cleanName
    );
    if (match) return match;
  }

  return null;
}

/**
 * Checks Party Master by company/party name, contact number(s), email(s), and GST.
 * Supports multiple contacts matching and merging into Party Master.
 * - If matching party exists: updates the master through party service and returns its partyId.
 * - If not exist: creates a new party with party_type 'leads' or 'quotation' and returns its partyId.
 */
export async function syncPartyMaster(input: SyncPartyMasterInput): Promise<SyncPartyMasterResult | null> {
  const cleanName = (input.partyName || "").trim();
  const cleanContactPerson = (input.contactPerson || "").trim();
  const cleanPhone = (input.phone || "").trim();
  const cleanEmail = (input.email || "").trim().toLowerCase();
  const cleanGst = (input.gst || "").replace(/\s+/g, "").toUpperCase();

  // Extract all phone numbers (last 10 digits) and emails from top-level and contacts array
  const cleanPhones10: string[] = [];
  const topPhoneDigits = cleanDigits(cleanPhone);
  if (topPhoneDigits.length >= 10) {
    cleanPhones10.push(topPhoneDigits.slice(-10));
  }

  const cleanEmails: string[] = [];
  if (cleanEmail) {
    cleanEmails.push(cleanEmail);
  }

  if (Array.isArray(input.contacts)) {
    input.contacts.forEach((c) => {
      const p = cleanDigits(c.phone || c.alternate_phone);
      if (p.length >= 10) {
        const p10 = p.slice(-10);
        if (!cleanPhones10.includes(p10)) cleanPhones10.push(p10);
      }
      const e = (c.email || "").trim().toLowerCase();
      if (e && !cleanEmails.includes(e)) {
        cleanEmails.push(e);
      }
    });
  }

  // If there is no party name, person name, contact number, or contacts, skip party master creation
  if (!cleanName && !cleanContactPerson && cleanPhones10.length === 0 && cleanEmails.length === 0) {
    return null;
  }

  const effectivePartyName = cleanName || cleanContactPerson || (input.contacts && input.contacts[0]?.name) || "Unnamed Party";

  let matchedParty: PartyItem | null = null;

  // If an ID was explicitly passed, verify it in existingParties
  if (input.partyId && typeof input.partyId === "string" && input.partyId.trim()) {
    const targetId = input.partyId.trim();
    matchedParty = input.existingParties.find(
      (p) => String(p._id ?? p.id ?? "") === targetId
    ) || null;
  }

  const matchCriteria = {
    cleanGst,
    cleanPhones10,
    cleanEmails,
    cleanName: effectivePartyName.toLowerCase(),
  };

  // If not matched by explicit ID, search existing in-memory parties
  if (!matchedParty) {
    matchedParty = matchPartyInList(input.existingParties, matchCriteria);
  }

  // If still not matched and lazy search function is provided, query Party Service
  if (!matchedParty && input.fetchPartiesBySearch) {
    const searchTerm = cleanGst || cleanPhones10[0] || cleanEmails[0] || effectivePartyName;
    if (searchTerm) {
      try {
        const searchRes: any = await input.fetchPartiesBySearch({ search: searchTerm, limit: "20" });
        const results: PartyItem[] = Array.isArray(searchRes?.data)
          ? searchRes.data
          : Array.isArray(searchRes?.items)
          ? searchRes.items
          : Array.isArray(searchRes)
          ? searchRes
          : [];
        matchedParty = matchPartyInList(results, matchCriteria);
      } catch (e) {
        // Fallback to in-memory result
      }
    }
  }

  if (matchedParty) {
    // Matched existing party: Update party master through party service
    const targetId = String(matchedParty._id ?? matchedParty.id ?? "");
    if (!targetId) return null;

    const patchPayload: PartyWriteBody = {};

    if (effectivePartyName && effectivePartyName !== matchedParty.party_name) {
      patchPayload.party_name = effectivePartyName;
    }
    if (cleanContactPerson && !matchedParty.contact_person) {
      patchPayload.contact_person = cleanContactPerson;
    }
    if (cleanPhone && !matchedParty.mobile && !matchedParty.phone) {
      patchPayload.mobile = cleanPhone;
    }
    if (cleanEmail && !matchedParty.email) {
      patchPayload.email = cleanEmail;
    }
    if (cleanGst && cleanGst !== (matchedParty.gst_no || "").toUpperCase()) {
      patchPayload.gst_no = cleanGst;
    }
    if (input.billingAddress && Object.keys(input.billingAddress).length > 0) {
      patchPayload.billing_address = input.billingAddress;
      if (input.billingAddress.country_id || input.countryId) {
        patchPayload.country_id = input.billingAddress.country_id || input.countryId;
      }
      if (input.billingAddress.state_id || input.stateId) {
        patchPayload.state_id = input.billingAddress.state_id || input.stateId;
      }
      if (input.billingAddress.city_id || input.cityId) {
        patchPayload.city_id = input.billingAddress.city_id || input.cityId;
      }
      if (input.billingAddress.state) patchPayload.state = input.billingAddress.state;
      if (input.billingAddress.city) patchPayload.city = input.billingAddress.city;
      if (input.billingAddress.country) patchPayload.country = input.billingAddress.country;
    }

    // Merge multiple contacts into existing party contacts without overwriting
    if (Array.isArray(input.contacts) && input.contacts.length > 0) {
      const existingList = Array.isArray(matchedParty.contacts) ? [...matchedParty.contacts] : [];
      let contactsChanged = false;

      for (const inC of input.contacts) {
        const inDigits = cleanDigits(inC.phone || inC.alternate_phone);
        const inP10 = inDigits.length >= 10 ? inDigits.slice(-10) : inDigits;
        const inEmail = (inC.email || "").trim().toLowerCase();
        const inName = (inC.name || "").trim().toLowerCase();

        const matchIdx = existingList.findIndex((exC: any) => {
          const exDigits = cleanDigits(exC.phone || exC.alternate_phone);
          const exP10 = exDigits.length >= 10 ? exDigits.slice(-10) : exDigits;
          const exEmail = (exC.email || "").trim().toLowerCase();
          const exName = (exC.name || "").trim().toLowerCase();

          if (inP10 && exP10 && inP10 === exP10) return true;
          if (inEmail && exEmail && inEmail === exEmail) return true;
          if (inName && exName && inName === exName) return true;
          return false;
        });

        if (matchIdx >= 0) {
          const ex = existingList[matchIdx];
          existingList[matchIdx] = {
            ...ex,
            name: ex.name || inC.name,
            phone: ex.phone || inC.phone,
            email: ex.email || inC.email,
            designation: ex.designation || inC.designation,
            department: ex.department || inC.department,
            alternate_phone: ex.alternate_phone || inC.alternate_phone,
          };
          contactsChanged = true;
        } else {
          existingList.push({
            name: inC.name,
            phone: inC.phone,
            email: inC.email,
            designation: inC.designation,
            department: inC.department,
            alternate_phone: inC.alternate_phone,
          });
          contactsChanged = true;
        }
      }

      if (contactsChanged) {
        patchPayload.contacts = existingList;
      }
    }

    try {
      if (Object.keys(patchPayload).length > 0) {
        await input.patchParty({ id: targetId, patch: patchPayload });
      }
    } catch (err) {
      console.warn("Failed to update party master via party service:", err);
    }

    return {
      partyId: targetId,
      matched: true,
      partyName: effectivePartyName,
    };
  } else {
    // Not found: Create new party master with party_type 'leads' or 'quotation' and multiple contacts
    const fallbackMobile = cleanPhone || (input.contacts && input.contacts[0]?.phone) || "0000000000";

    const createPayload: PartyWriteBody = {
      party_type: input.partyType,
      party_name: effectivePartyName,
      contact_person: cleanContactPerson || (input.contacts && input.contacts[0]?.name) || undefined,
      mobile: fallbackMobile,
      email: cleanEmail || (input.contacts && input.contacts[0]?.email) || undefined,
      gst_no: cleanGst || undefined,
      billing_address: input.billingAddress && Object.keys(input.billingAddress).length > 0
        ? input.billingAddress
        : undefined,
      country_id: input.billingAddress?.country_id || input.countryId || undefined,
      state_id: input.billingAddress?.state_id || input.stateId || undefined,
      city_id: input.billingAddress?.city_id || input.cityId || undefined,
      state: input.billingAddress?.state || undefined,
      city: input.billingAddress?.city || undefined,
      country: input.billingAddress?.country || undefined,
      contacts: Array.isArray(input.contacts) ? input.contacts : [],
      is_active: true,
    };

    try {
      const created: any = await input.createParty(createPayload);
      const newId = String(created?._id ?? created?.id ?? created?.data?._id ?? created?.data?.id ?? "");
      return {
        partyId: newId,
        matched: false,
        partyName: effectivePartyName,
      };
    } catch (err) {
      console.error("Failed to create party master via party service:", err);
      return null;
    }
  }
}
