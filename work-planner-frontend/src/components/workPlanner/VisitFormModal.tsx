"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import {
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Info,
  Mail,
  Phone,
  Plus,
  Search,
  Trash2,
  User,
  UserCheck,
  Users,
  MapPin,
  X,
} from "lucide-react";
import type { WorkPlanVisitPartyType, WorkPlanVisitRecord } from "@/types/workPlanner";
import type { PartyRecord } from "@/types/party";
import type { LeadRecord } from "@/types/lead";
import type { PowerFacility, PowerEnquiry } from "@/types/powerApp";
import {
  useGetPartiesQuery,
  useGetPartyCountriesQuery,
  useGetPartyStatesQuery,
  useGetPartyCitiesQuery,
} from "@/store/api/partyApiSlice";
import { useGetLeadsQuery } from "@/store/api/leadsApiSlice";
import {
  useGetPowerFacilitiesQuery,
  useGetPowerEnquiriesQuery,
} from "@/store/api/powerAppApiSlice";
import { useGetUsersQuery } from "@/store/api/authApiSlice";
import { useGetMyTeamQuery, useGetPlansQuery } from "@/store/api/workPlannerApiSlice";
import {
  isWpAdmin,
  isWpManager,
  isWpElevated,
  isPowerAuditUser,
  hasWorkPlannerPortalAccess,
  readSessionFromStorage,
} from "@/utils/authStorage";
import { formatPlanDate, formatAuditUser, formatDateTime } from "./workPlanUtils";

export type VisitFormModalProps = {
  open: boolean;
  mode: "create" | "edit";
  initial?: WorkPlanVisitRecord | null;
  planDate?: string | null;
  /** Assigned executive on the parent work plan — used to scope Existing Leads search & assignment. */
  salesUserId?: string | null;
  /** ID of the plan owner — used to determine if current user is the senior */
  planOwnerId?: string | null;
  defaultCountryId?: string;
  defaultCountryName?: string;
  defaultStateId?: string;
  defaultStateName?: string;
  defaultCityId?: string;
  defaultCityName?: string;
  defaultCityIds?: string[];
  defaultCityNames?: string[];
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (body: Record<string, unknown>) => void | Promise<void>;
};

interface ExecutiveUser {
  _id: string;
  id?: string;
  name: string;
  email: string;
  department?: string;
  portals?: Array<{
    portal_code?: string;
    portal?: { code?: string };
    code?: string;
    access_roles?: string[];
  }>;
}

function hasWorkPlannerAccess(u: ExecutiveUser | any, sessionUserId?: string): boolean {
  if (!u) return false;
  const uId = String(u._id || u.id || "");
  if (sessionUserId && uId === String(sessionUserId)) return true;
  return hasWorkPlannerPortalAccess(u);
}

const PARTY_TYPE_OPTIONS: Array<{ value: WorkPlanVisitPartyType; label: string }> = [
  { value: "existing", label: "Existing Party" },
  { value: "existing_lead", label: "Existing Leads" },
  { value: "new_party", label: "New Party" },
];

const inputClass =
  "w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60";
const labelClass = "mb-1.5 block text-xs font-medium text-muted";

function ymdFromPlanDate(planDate?: string | null): string {
  if (!planDate) return "";
  const trimmed = String(planDate).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function timeFromIso(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function combinePlanDateAndTime(
  planDate: string | undefined | null,
  time: string,
): string | undefined {
  if (!time) return undefined;
  const ymd = ymdFromPlanDate(planDate) || new Date().toISOString().slice(0, 10);
  const normalizedTime = time.length === 5 ? `${time}:00` : time;
  const local = new Date(`${ymd}T${normalizedTime}`);
  if (isNaN(local.getTime())) {
    const d = new Date(time);
    if (!isNaN(d.getTime())) return d.toISOString();
    return time;
  }
  return local.toISOString();
}

function partyNameOf(visit?: WorkPlanVisitRecord | null): string {
  if (!visit) return "";
  if (visit.party_name) return visit.party_name;
  if (typeof visit.party === "object" && visit.party?.party_name) return visit.party.party_name;
  return "";
}

function formatPartyAddress(party: PartyRecord): string {
  if (party.billing_address) {
    const parts = [
      party.billing_address.street,
      party.billing_address.city,
      party.billing_address.state,
      party.billing_address.pincode,
    ].filter(Boolean);
    if (parts.length > 0) return parts.join(", ");
  }
  if (party.shipping_address) {
    const parts = [
      party.shipping_address.street,
      party.shipping_address.city,
      party.shipping_address.state,
      party.shipping_address.pincode,
    ].filter(Boolean);
    if (parts.length > 0) return parts.join(", ");
  }
  const parts = [party.district, party.state].filter(Boolean);
  return parts.join(", ");
}

function formatLeadAddress(lead: LeadRecord): string {
  const addr = lead.billing_address;
  if (!addr) return "";
  const parts = [
    addr.address_line_1,
    addr.address_line_2,
    addr.city,
    addr.state,
    addr.pincode,
  ].filter(Boolean);
  return parts.join(", ");
}

function leadDisplayName(lead: LeadRecord): string {
  return lead.company_name?.trim() || lead.name?.trim() || lead.lead_no || "Lead";
}

function primaryLeadContact(lead: LeadRecord) {
  const contacts = lead.contacts || [];
  return contacts.find((c) => c.is_primary) || contacts[0];
}

interface ContactFormItem {
  id: string;
  contact_person: string;
  contact_number: string;
  contact_email: string;
  designation?: string;
}

export function VisitFormModal({
  open,
  mode,
  initial,
  planDate,
  salesUserId,
  planOwnerId = null,
  defaultCountryId,
  defaultCountryName,
  defaultStateId,
  defaultStateName,
  defaultCityId,
  defaultCityName,
  defaultCityIds = [],
  defaultCityNames = [],
  isSaving,
  onClose,
  onSubmit,
}: VisitFormModalProps) {
  const sessionUser = useMemo(() => readSessionFromStorage()?.user, []);
  const sessionUserId = sessionUser?._id || (sessionUser as { id?: string })?.id || "";
  const adminRole = isWpAdmin(sessionUser);
  const managerRole = isWpManager(sessionUser);
  const elevatedRole = isWpElevated(sessionUser);
  const itemOwnerId = String(
    planOwnerId ||
    (initial as any)?.sales_user?._id ||
    (initial as any)?.sales_user ||
    sessionUserId ||
    ""
  );
  const isSelf = Boolean(sessionUserId && itemOwnerId && String(sessionUserId) === String(itemOwnerId));
  const isSeniorViewing = elevatedRole && !isSelf;

  // Queries for allowed executives
  const { data: usersData } = useGetUsersQuery(undefined, { skip: !open || !adminRole });
  const { data: myTeamData } = useGetMyTeamQuery(undefined, { skip: !open || adminRole || !managerRole });

  const allUsers = useMemo<ExecutiveUser[]>(() => {
    if (adminRole) return (usersData as ExecutiveUser[]) || [];
    const list: ExecutiveUser[] = [];
    const seen = new Set<string>();

    const addUser = (u: any) => {
      if (!u) return;
      const id = String(u._id || u.id || "");
      if (id && !seen.has(id)) {
        seen.add(id);
        list.push(u as ExecutiveUser);
      }
    };

    if (sessionUser) addUser(sessionUser);
    if (Array.isArray(myTeamData?.members)) {
      myTeamData.members.forEach(addUser);
    }
    if (Array.isArray(myTeamData?.edges)) {
      myTeamData.edges.forEach((e: any) => {
        if (e.manager) addUser(e.manager);
        if (e.user) addUser(e.user);
      });
    }
    return list;
  }, [adminRole, usersData, sessionUser, myTeamData]);

  // Allowed Executives for assignment:
  // - Admin: all portal members with work_planner access
  // - Manager: himself + executives reporting to him
  // - Executive: himself only
  const allowedExecutives = useMemo<ExecutiveUser[]>(() => {
    if (!elevatedRole) {
      if (!sessionUser) return [];
      return [
        {
          _id: sessionUserId,
          id: sessionUserId,
          name: `${sessionUser.name} (Self)`,
          email: sessionUser.email,
          department: sessionUser.department,
        },
      ];
    }

    if (adminRole) {
      const list = allUsers.filter((u) => hasWorkPlannerAccess(u, sessionUserId));
      if (salesUserId && !list.some((u) => String(u._id || u.id || "") === String(salesUserId))) {
        const found = allUsers.find((u) => String(u._id || u.id || "") === String(salesUserId));
        if (found) list.push(found);
      }
      return list;
    }

    const myTeamMembers = (myTeamData?.members || []) as Array<{ _id?: string; id?: string }>;
    const teamIdSet = new Set<string>(
      myTeamMembers.map((m) => String(m._id || m.id || ""))
    );
    if (sessionUserId) {
      teamIdSet.add(String(sessionUserId));
    }
    if (salesUserId) {
      teamIdSet.add(String(salesUserId));
    }
    return allUsers.filter((u) => teamIdSet.has(String(u._id || u.id || "")));
  }, [allUsers, sessionUser, sessionUserId, adminRole, elevatedRole, myTeamData, salesUserId]);

  // Modal internal editable states
  const [internalPlanDate, setInternalPlanDate] = useState<string>(
    () => ymdFromPlanDate(planDate) || new Date().toISOString().slice(0, 10)
  );
  const [internalSalesUserId, setInternalSalesUserId] = useState<string>(
    () => salesUserId || sessionUserId || ""
  );

  const effectiveSalesUserId = internalSalesUserId || sessionUserId || "";
  const { data: plansData, isFetching: isCheckingPlan } = useGetPlansQuery(
    {
      sales_user: effectiveSalesUserId,
      date: internalPlanDate,
      limit: 1,
    },
    { skip: !open || !internalPlanDate || !effectiveSalesUserId }
  );

  const existingPlan = useMemo(() => {
    const list = plansData?.data || [];
    return list.find((p) => !(p as any).deletedAt && !String(p._id || p.id).startsWith("standalone"));
  }, [plansData]);
  const planCompleted = existingPlan?.status === "completed";

  const selectedExecutiveUser = useMemo(() => {
    return (
      allowedExecutives.find(
        (u) => String(u._id || u.id || "") === String(effectiveSalesUserId)
      ) || sessionUser
    );
  }, [allowedExecutives, effectiveSalesUserId, sessionUser]);

  const isPowerAudit = useMemo(() => {
    return isPowerAuditUser(selectedExecutiveUser) || isPowerAuditUser(sessionUser);
  }, [selectedExecutiveUser, sessionUser]);

  const partyTypeOptions = useMemo<Array<{ value: WorkPlanVisitPartyType; label: string }>>(() => {
    if (isPowerAudit) {
      return [
        { value: "facility", label: "Audit Facility" },
        { value: "enquiry", label: "Audit Enquiry" },
        { value: "existing", label: "Existing Party" },
        { value: "existing_lead", label: "Existing Leads" },
        { value: "new_party", label: "New Party" },
      ];
    }
    return PARTY_TYPE_OPTIONS;
  }, [isPowerAudit]);

  const [partyType, setPartyType] = useState<WorkPlanVisitPartyType>(() =>
    isPowerAudit ? "facility" : "existing"
  );
  const [selectedPartyId, setSelectedPartyId] = useState<string>("");
  const [selectedLeadId, setSelectedLeadId] = useState<string>("");
  const [partyName, setPartyName] = useState("");
  const [gstNo, setGstNo] = useState("");
  const [contacts, setContacts] = useState<ContactFormItem[]>([
    { id: "c-1", contact_person: "", contact_number: "", contact_email: "" },
  ]);
  const [address, setAddress] = useState("");
  const [countryId, setCountryId] = useState("");
  const [countryName, setCountryName] = useState("");
  const [stateId, setStateId] = useState("");
  const [stateName, setStateName] = useState("");
  const [cityId, setCityId] = useState("");
  const [cityName, setCityName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [notes, setNotes] = useState("");
  const [managerRemarks, setManagerRemarks] = useState("");
  const [plannedStartTime, setPlannedStartTime] = useState("");
  const [plannedEndTime, setPlannedEndTime] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [partySearch, setPartySearch] = useState("");
  const [leadSearch, setLeadSearch] = useState("");
  const [facilitySearch, setFacilitySearch] = useState("");
  const [enquirySearch, setEnquirySearch] = useState("");
  const [partyDropdownOpen, setPartyDropdownOpen] = useState(false);
  const [leadDropdownOpen, setLeadDropdownOpen] = useState(false);
  const [facilityDropdownOpen, setFacilityDropdownOpen] = useState(false);
  const [enquiryDropdownOpen, setEnquiryDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const cityFilterDropdownRef = useRef<HTMLDivElement>(null);

  const [filterCityIds, setFilterCityIds] = useState<string[]>(() =>
    Array.isArray(defaultCityIds) && defaultCityIds.length > 0
      ? defaultCityIds
      : defaultCityId
      ? [defaultCityId]
      : []
  );
  const [filterCityNames, setFilterCityNames] = useState<string[]>(() =>
    Array.isArray(defaultCityNames) && defaultCityNames.length > 0
      ? defaultCityNames
      : defaultCityName
      ? [defaultCityName]
      : []
  );
  const [isCityFilterOpen, setIsCityFilterOpen] = useState(false);
  const [cityFilterSearch, setCityFilterSearch] = useState("");

  const isFacility = partyType === "facility";
  const isEnquiry = partyType === "enquiry";
  const isExistingParty = partyType === "existing";
  const isExistingLead = partyType === "existing_lead";
  const isExistingType = isFacility || isEnquiry || isExistingParty || isExistingLead;
  const assignedExecutiveId = internalSalesUserId?.trim() || "";

  const { data: partiesData = [], isLoading: isPartiesLoading } = useGetPartiesQuery(
    {
      search: partySearch.trim() || undefined,
      state_id: stateId || undefined,
      city_id: filterCityIds.length === 1 ? filterCityIds[0] : undefined,
      city_ids: filterCityIds.length > 0 ? filterCityIds.join(",") : undefined,
      cities: filterCityNames.length > 0 ? filterCityNames.join(",") : undefined,
      state: stateName || undefined,
      country_id: countryId || undefined,
    },
    { skip: !open || !isExistingParty }
  );

  const filteredParties = useMemo(() => {
    if (!filterCityNames.length && !filterCityIds.length) return partiesData;
    const lowerNames = filterCityNames.map((n) => n.toLowerCase().trim()).filter(Boolean);
    const idSet = new Set(filterCityIds.filter(Boolean));
    return partiesData.filter((party: PartyRecord) => {
      if (party.city_id && idSet.has(String(party.city_id))) return true;
      const pCity = (
        party.city ||
        (party.billing_address as any)?.city ||
        (party.shipping_address as any)?.city ||
        party.district ||
        ""
      ).toLowerCase().trim();
      if (pCity && lowerNames.some((c) => pCity.includes(c) || c.includes(pCity))) return true;
      return false;
    });
  }, [partiesData, filterCityNames, filterCityIds]);

  const { data: countriesData = [], isLoading: isCountriesLoading } = useGetPartyCountriesQuery(
    { limit: 500, status: "active" },
    { skip: !open }
  );

  const { data: statesData = [], isLoading: isStatesLoading } = useGetPartyStatesQuery(
    countryId ? { country_id: countryId, limit: 1000, status: "active" } : undefined,
    { skip: !open || !countryId }
  );

  const { data: citiesData = [], isLoading: isCitiesLoading } = useGetPartyCitiesQuery(
    stateId ? { state_id: stateId, limit: 5000, status: "active" } : undefined,
    { skip: !open || !stateId }
  );

  // Auto-select India by default if no country selected
  useEffect(() => {
    if (!countryId && countriesData.length > 0) {
      const india = countriesData.find(
        (c) =>
          c.name.trim().toLowerCase() === "india" ||
          c.iso_code?.toUpperCase() === "IN"
      );
      if (india) {
        setCountryId(india._id || india.id || "");
        setCountryName(india.name);
      }
    }
  }, [countriesData, countryId]);

  // Match state name to state ID if set by text from Party or Lead
  useEffect(() => {
    if (stateName && !stateId && statesData.length > 0) {
      const sMatch = statesData.find(
        (s) => s.name.trim().toLowerCase() === stateName.trim().toLowerCase()
      );
      if (sMatch) {
        setStateId(sMatch._id || sMatch.id || "");
      }
    }
  }, [statesData, stateName, stateId]);

  // If stateId is set but does not belong to the currently loaded states for this country, clear it
  useEffect(() => {
    if (stateId && statesData.length > 0 && !isStatesLoading) {
      const exists = statesData.some((s) => s._id === stateId || s.id === stateId);
      if (!exists) {
        setStateId("");
        setStateName("");
        setCityId("");
        setCityName("");
      }
    }
  }, [statesData, stateId, isStatesLoading]);

  // Match city name to city ID if set by text from Party or Lead
  useEffect(() => {
    if (cityName && !cityId && citiesData.length > 0) {
      const ciMatch = citiesData.find(
        (ci) => ci.name.trim().toLowerCase() === cityName.trim().toLowerCase()
      );
      if (ciMatch) {
        setCityId(ciMatch._id || ciMatch.id || "");
      }
    }
  }, [citiesData, cityName, cityId]);

  // If cityId is set but does not belong to the currently loaded cities for this state, clear it
  useEffect(() => {
    if (cityId && citiesData.length > 0 && !isCitiesLoading) {
      const exists = citiesData.some((ci) => ci._id === cityId || ci.id === cityId);
      if (!exists) {
        setCityId("");
        setCityName("");
      }
    }
  }, [citiesData, cityId, isCitiesLoading]);

  const { data: leadsData = [], isLoading: isLeadsLoading } = useGetLeadsQuery(
    {
      search: leadSearch.trim() || undefined,
      assigned_to: assignedExecutiveId || undefined,
      state: stateName || undefined,
      city: cityName || undefined,
      limit: 30,
      paginate: "true",
    },
    { skip: !open || !isExistingLead }
  );

  const { data: facilitiesData = [], isLoading: isFacilitiesLoading } = useGetPowerFacilitiesQuery(
    { search: facilitySearch.trim() || undefined, limit: 30 },
    { skip: !open || !isFacility }
  );

  const { data: enquiriesData = [], isLoading: isEnquiriesLoading } = useGetPowerEnquiriesQuery(
    { search: enquirySearch.trim() || undefined, limit: 30 },
    { skip: !open || !isEnquiry }
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setPartyDropdownOpen(false);
        setLeadDropdownOpen(false);
        setFacilityDropdownOpen(false);
        setEnquiryDropdownOpen(false);
      }
      if (
        cityFilterDropdownRef.current &&
        !cityFilterDropdownRef.current.contains(event.target as Node)
      ) {
        setIsCityFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Only re-initialize when modal transitions from closed to open or when initial record changes
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && (!prevOpenRef.current || initial)) {
      setInternalPlanDate(ymdFromPlanDate(planDate) || new Date().toISOString().slice(0, 10));
      const targetSalesUser =
        (typeof initial?.sales_user === "object"
          ? (initial.sales_user as any)?._id || (initial.sales_user as any)?.id
          : typeof initial?.sales_user === "string"
          ? initial.sales_user
          : "") ||
        salesUserId ||
        sessionUserId ||
        "";
      setInternalSalesUserId(targetSalesUser);

      const initCityIds =
        Array.isArray(defaultCityIds) && defaultCityIds.length > 0
          ? defaultCityIds
          : initial?.city_id
          ? [initial.city_id]
          : defaultCityId
          ? [defaultCityId]
          : [];
      const initCityNames =
        Array.isArray(defaultCityNames) && defaultCityNames.length > 0
          ? defaultCityNames
          : initial?.city
          ? [initial.city]
          : defaultCityName
          ? [defaultCityName]
          : [];
      setFilterCityIds(initCityIds);
      setFilterCityNames(initCityNames);
      setIsCityFilterOpen(false);
      setCityFilterSearch("");

      if (initial) {
        setPartyType(initial.party_type || (isPowerAudit ? "facility" : "existing"));
        const pId =
          typeof initial.party === "object" && initial.party
            ? initial.party._id || (initial.party as { id?: string }).id
            : typeof initial.party === "string"
              ? initial.party
              : "";
        setSelectedPartyId(pId || "");
        setSelectedLeadId("");
        setPartyName(partyNameOf(initial));

        const rawContacts = Array.isArray(initial.contacts) && initial.contacts.length > 0
          ? initial.contacts
          : (initial.contact_person || initial.contact_number || initial.phone || initial.contact_email)
            ? [
                {
                  contact_person: initial.contact_person || "",
                  contact_number: initial.contact_number || initial.phone || "",
                  contact_email: initial.contact_email || "",
                },
              ]
            : [];

        if (rawContacts.length > 0) {
          setContacts(
            rawContacts.map((c: any, i) => ({
              id: `c-init-${i}-${Date.now()}`,
              contact_person: c.contact_person || c.name || "",
              contact_number: c.contact_number || c.phone || c.alternate_phone || "",
              contact_email: c.contact_email || c.email || "",
              designation: c.designation || c.department || "",
            }))
          );
        } else {
          setContacts([{ id: "c-1", contact_person: "", contact_number: "", contact_email: "" }]);
        }

        setAddress(initial.address || "");
        setCountryId(initial.country_id || "");
        setCountryName(initial.country || "");
        setStateId(initial.state_id || "");
        setStateName(initial.state || "");
        setCityId(initial.city_id || "");
        setCityName(initial.city || "");
        setGstNo((initial as any)?.gst_no || (initial as any)?.gst || "");
        setPurpose(initial.purpose || "");
        setNotes(initial.notes || "");
        setManagerRemarks(initial.manager_remarks || "");
        setPlannedStartTime(timeFromIso(initial.planned_start_time));
        setPlannedEndTime(timeFromIso(initial.planned_end_time));
      } else {
        setPartyType(isPowerAudit ? "facility" : "existing");
        setSelectedPartyId("");
        setSelectedLeadId("");
        setPartyName("");
        setGstNo("");
        setContacts([{ id: "c-1", contact_person: "", contact_number: "", contact_email: "" }]);
        setAddress("");
        setCountryId(defaultCountryId || "");
        setCountryName(defaultCountryName || "");
        setStateId(defaultStateId || "");
        setStateName(defaultStateName || "");
        setCityId(defaultCityId || "");
        setCityName(defaultCityName || "");
        setPurpose("");
        setNotes("");
        setManagerRemarks("");
        setPlannedStartTime("");
        setPlannedEndTime("");
      }
      setPartySearch("");
      setLeadSearch("");
      setFacilitySearch("");
      setEnquirySearch("");
      setPartyDropdownOpen(false);
      setLeadDropdownOpen(false);
      setFacilityDropdownOpen(false);
      setEnquiryDropdownOpen(false);
      setErrors({});
    }
    prevOpenRef.current = open;
  }, [
    open,
    initial,
    planDate,
    salesUserId,
    sessionUserId,
    isPowerAudit,
    defaultCityIds,
    defaultCityNames,
    defaultCityId,
    defaultCityName,
  ]);

  if (!open) return null;

  function handleSelectParty(party: PartyRecord) {
    const pId = party._id || party.id || "";
    setSelectedPartyId(pId);
    setSelectedLeadId("");
    setPartyName(party.party_name || "");
    setGstNo(party.gst_no || "");
    setAddress(formatPartyAddress(party));

    // Geography sync from selected Party
    if (party.country_id) {
      setCountryId(party.country_id);
      const cMatch = countriesData.find((c) => c._id === party.country_id || c.id === party.country_id);
      setCountryName(cMatch?.name || "India");
    } else {
      const cName = (party.billing_address as any)?.country || "India";
      setCountryName(cName);
      const cMatch = countriesData.find((c) => c.name.toLowerCase() === cName.toLowerCase());
      if (cMatch) setCountryId(cMatch._id || cMatch.id || "");
    }

    if (party.state_id) {
      setStateId(party.state_id);
      setStateName(party.state || "");
    } else if (party.state || (party.billing_address as any)?.state) {
      const sName = party.state || (party.billing_address as any)?.state || "";
      setStateName(sName);
      setStateId("");
    } else {
      setStateId("");
      setStateName("");
    }

    if (party.city_id) {
      setCityId(party.city_id);
      setCityName(party.city || (party.billing_address as any)?.city || "");
    } else if (party.city || (party.billing_address as any)?.city) {
      const ctName = party.city || (party.billing_address as any)?.city || "";
      setCityName(ctName);
      setCityId("");
    } else {
      setCityId("");
      setCityName("");
    }

    const list: ContactFormItem[] = [];
    if (Array.isArray(party.contacts) && party.contacts.length > 0) {
      party.contacts.forEach((c, idx) => {
        const name = (c.contact_person || c.name || "").trim();
        const phone = (c.contact_number || c.phone || c.alternate_phone || "").trim();
        const email = (c.contact_email || c.email || "").trim();
        const desig = (c.designation || c.department || "").trim();
        if (name || phone || email) {
          list.push({
            id: `party-c-${idx}-${Date.now()}`,
            contact_person: name,
            contact_number: phone,
            contact_email: email,
            designation: desig,
          });
        }
      });
    }

    if (list.length === 0 && (party.contact_person || party.mobile || party.email)) {
      list.push({
        id: `party-root-${Date.now()}`,
        contact_person: party.contact_person || "",
        contact_number: party.mobile || "",
        contact_email: party.email || "",
      });
    }

    if (list.length === 0) {
      list.push({ id: "c-1", contact_person: "", contact_number: "", contact_email: "" });
    }

    setContacts(list);
    setPartyDropdownOpen(false);
    setPartySearch("");
    setErrors({});
  }

  function handleSelectFacility(facility: PowerFacility) {
    const fId = facility.id || facility._id || "";
    setSelectedPartyId(fId);
    setSelectedLeadId("");
    setPartyName(facility.name || "");

    const parts = [facility.address, facility.city].filter(Boolean);
    if (parts.length > 0) {
      setAddress(parts.join(", "));
    }

    if (facility.audit_type) {
      setPurpose(facility.audit_type);
    }

    const reps = Array.isArray(facility.client_representatives) && facility.client_representatives.length > 0
      ? facility.client_representatives
      : [];

    const list: ContactFormItem[] = [];
    reps.forEach((rep, idx) => {
      if (rep.name || rep.contact_number || rep.email) {
        list.push({
          id: `c-fac-${idx}-${Date.now()}`,
          contact_person: rep.name || "",
          contact_number: rep.contact_number || "",
          contact_email: rep.email || "",
          designation: rep.designation || "",
        });
      }
    });

    if (list.length === 0 && (facility.client_representative || facility.client_contact_number || facility.client_email)) {
      list.push({
        id: `c-fac-main-${Date.now()}`,
        contact_person: facility.client_representative || "",
        contact_number: facility.client_contact_number || "",
        contact_email: facility.client_email || "",
      });
    }

    if (list.length > 0) {
      setContacts(list);
    } else {
      setContacts([{ id: "c-1", contact_person: "", contact_number: "", contact_email: "" }]);
    }

    if (facility.audit_number) {
      setNotes((prev) => (prev ? prev : `Audit Number: ${facility.audit_number}`));
    }

    setFacilityDropdownOpen(false);
    setFacilitySearch("");
    setErrors({});
  }

  function handleSelectEnquiry(enquiry: PowerEnquiry) {
    const eId = enquiry.id || enquiry._id || "";
    setSelectedPartyId(eId);
    setSelectedLeadId(eId);
    setPartyName(enquiry.name || "");

    const parts = [enquiry.address, enquiry.city].filter(Boolean);
    if (parts.length > 0) {
      setAddress(parts.join(", "));
    }

    if (Array.isArray(enquiry.requested_audit_types) && enquiry.requested_audit_types.length > 0) {
      setPurpose(enquiry.requested_audit_types.join(", "));
    } else if (enquiry.source) {
      setPurpose(`Enquiry Follow-up (${enquiry.source})`);
    }

    const reps = Array.isArray(enquiry.client_representatives) && enquiry.client_representatives.length > 0
      ? enquiry.client_representatives
      : [];

    const list: ContactFormItem[] = [];
    reps.forEach((rep, idx) => {
      if (rep.name || rep.contact_number || rep.email) {
        list.push({
          id: `c-enq-${idx}-${Date.now()}`,
          contact_person: rep.name || "",
          contact_number: rep.contact_number || "",
          contact_email: rep.email || "",
          designation: rep.designation || "",
        });
      }
    });

    if (list.length === 0 && (enquiry.client_representative || enquiry.client_contact_number || enquiry.client_email)) {
      list.push({
        id: `c-enq-main-${Date.now()}`,
        contact_person: enquiry.client_representative || "",
        contact_number: enquiry.client_contact_number || "",
        contact_email: enquiry.client_email || "",
      });
    }

    if (list.length > 0) {
      setContacts(list);
    } else {
      setContacts([{ id: "c-1", contact_person: "", contact_number: "", contact_email: "" }]);
    }

    if (enquiry.enquiry_number) {
      setNotes((prev) => (prev ? prev : `Enquiry Number: ${enquiry.enquiry_number}`));
    }

    setEnquiryDropdownOpen(false);
    setEnquirySearch("");
    setErrors({});
  }

  function handleSelectLead(lead: LeadRecord) {
    const leadId = lead._id || lead.id || "";
    setSelectedLeadId(leadId);
    setSelectedPartyId("");
    setPartyName(leadDisplayName(lead));
    setGstNo((lead as any).gst_no || (lead as any).gstin || "");
    setAddress(formatLeadAddress(lead));

    const lState = lead.billing_address?.state || lead.state;
    const lCity = lead.billing_address?.city || lead.city;
    const lCountry = lead.billing_address?.country || lead.country;
    if (lState) setStateName(lState);
    if (lCity) setCityName(lCity);
    if (lCountry) setCountryName(lCountry);

    const list: ContactFormItem[] = [];
    if (Array.isArray(lead.contacts) && lead.contacts.length > 0) {
      lead.contacts.forEach((c, idx) => {
        if (c.name || c.phone || c.alternate_phone || c.email) {
          list.push({
            id: `lead-c-${idx}-${Date.now()}`,
            contact_person: c.name || "",
            contact_number: c.phone || c.alternate_phone || "",
            contact_email: c.email || "",
            designation: c.designation || c.department || "",
          });
        }
      });
    }

    if (list.length === 0 && (lead.name || lead.phone || lead.alternate_phone || lead.email)) {
      list.push({
        id: `lead-root-${Date.now()}`,
        contact_person: lead.name || "",
        contact_number: lead.phone || lead.alternate_phone || "",
        contact_email: lead.email || "",
      });
    }

    if (list.length === 0) {
      list.push({ id: "c-1", contact_person: "", contact_number: "", contact_email: "" });
    }

    setContacts(list);
    setLeadDropdownOpen(false);
    setLeadSearch("");
    setErrors({});
  }

  function handlePartyTypeChange(nextType: WorkPlanVisitPartyType) {
    setPartyType(nextType);
    if (nextType === "new_party") {
      setSelectedPartyId("");
      setSelectedLeadId("");
    }
    if (nextType === "existing" || nextType === "facility") {
      setSelectedLeadId("");
    }
    if (nextType === "existing_lead") {
      setSelectedPartyId("");
    }
    setPartyDropdownOpen(false);
    setLeadDropdownOpen(false);
    setFacilityDropdownOpen(false);
    setEnquiryDropdownOpen(false);
  }

  const handleAddContact = () => {
    setContacts((prev) => [
      ...prev,
      {
        id: `c-new-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        contact_person: "",
        contact_number: "",
        contact_email: "",
      },
    ]);
  };

  const handleRemoveContact = (index: number) => {
    if (contacts.length <= 1) return;
    setContacts((prev) => prev.filter((_, i) => i !== index));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[`contactPerson_${index}`];
      delete next[`contactNumber_${index}`];
      delete next[`contactEmail_${index}`];
      return next;
    });
  };

  const handleContactChange = (index: number, field: keyof ContactFormItem, value: string) => {
    setContacts((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    const errKey =
      field === "contact_person"
        ? `contactPerson_${index}`
        : field === "contact_number"
        ? `contactNumber_${index}`
        : `contactEmail_${index}`;
    if (errors[errKey]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[errKey];
        return next;
      });
    }
  };

  async function handleSave() {
    if (planCompleted) return;
    const errs: Record<string, string> = {};
    if (!internalPlanDate) {
      errs.planDate = "Plan date is required";
    }
    if (!partyName.trim()) {
      errs.partyName = isFacility
        ? "Facility name is required"
        : isEnquiry
        ? "Enquiry name is required"
        : isExistingLead
        ? "Lead / company name is required"
        : "Party/Company name is required";
    }
    if (isExistingParty && !selectedPartyId) {
      errs.partyName = "Select an existing party from the list";
    }
    if (isFacility && !selectedPartyId) {
      errs.partyName = "Select a facility from the search list";
    }
    if (isEnquiry && !selectedPartyId) {
      errs.partyName = "Select an enquiry from the search list";
    }

    if (contacts.length === 0) {
      errs.contacts = "At least one contact person is required";
    }

    contacts.forEach((c, idx) => {
      if (!c.contact_person.trim()) {
        errs[`contactPerson_${idx}`] = "Contact person name is required";
      }
      if (!c.contact_number.trim()) {
        errs[`contactNumber_${idx}`] = "Contact phone / mobile is required";
      }
      if (c.contact_email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.contact_email.trim())) {
        errs[`contactEmail_${idx}`] = "Enter a valid email address";
      }
    });

    if (!countryId && !countryName.trim()) {
      errs.country = "Country is required";
    }
    if (!stateId && !stateName.trim()) {
      errs.state = "State is required";
    }
    if (!cityId && !cityName.trim()) {
      errs.city = "City is required";
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    const primary = contacts[0] || { contact_person: "", contact_number: "", contact_email: "" };
    const primarySanitizedEmail =
      primary.contact_email?.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(primary.contact_email.trim())
        ? primary.contact_email.trim()
        : `${(primary.contact_person.trim().toLowerCase().replace(/[^a-z0-9]/g, "") || "contact")}@client.com`;

    const cleanContacts = contacts.map((c) => ({
      contact_person: c.contact_person.trim(),
      contact_number: c.contact_number.trim(),
      contact_email:
        c.contact_email?.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.contact_email.trim())
          ? c.contact_email.trim()
          : undefined,
      ...(c.designation?.trim() ? { designation: c.designation.trim() } : {}),
    }));

    // Backend of work-planner checks and creates/updates Party Master with party_type 'visits'
    onSubmit({
      planDate: internalPlanDate,
      salesUserId: internalSalesUserId || sessionUserId,
      party_type: partyType,
      ...((isExistingParty || isFacility || isEnquiry) && selectedPartyId ? { party: selectedPartyId } : {}),
      party_name: partyName.trim(),
      contact_person: primary.contact_person.trim(),
      contact_number: primary.contact_number.trim(),
      contact_email: primarySanitizedEmail,
      contacts: cleanContacts,
      address: address.trim() || undefined,
      country_id: countryId || undefined,
      state_id: stateId || undefined,
      city_id: cityId || undefined,
      country: countryName || undefined,
      state: stateName || undefined,
      city: cityName || undefined,
      gst_no: gstNo.trim() || undefined,
      purpose: purpose.trim() || undefined,
      notes: notes.trim() || undefined,
      manager_remarks: managerRemarks.trim() || undefined,
      planned_start_time: combinePlanDateAndTime(internalPlanDate, plannedStartTime),
      planned_end_time: combinePlanDateAndTime(internalPlanDate, plannedEndTime),
    });
  }

  const searchLabel = isFacility
    ? "Search Audit Facility"
    : isEnquiry
    ? "Search Audit Enquiry"
    : isExistingLead
    ? "Search Existing Lead"
    : "Search Existing Party / Lead";

  const searchPlaceholder = isFacility
    ? "Search by facility name, audit no, city, contact..."
    : isEnquiry
    ? "Search by enquiry name, enquiry no, city, contact..."
    : isExistingLead
    ? "Search by company, contact, phone, lead no..."
    : "Search by party name, mobile, email...";

  const dropdownOpen = isFacility
    ? facilityDropdownOpen
    : isEnquiry
    ? enquiryDropdownOpen
    : isExistingLead
    ? leadDropdownOpen
    : partyDropdownOpen;

  const searchValue = isFacility
    ? facilityDropdownOpen
      ? facilitySearch
      : partyName
    : isEnquiry
    ? enquiryDropdownOpen
      ? enquirySearch
      : partyName
    : isExistingLead
    ? leadDropdownOpen
      ? leadSearch
      : partyName
    : partyDropdownOpen
      ? partySearch
      : partyName;

  const isSearchLoading = isFacility
    ? isFacilitiesLoading
    : isEnquiry
    ? isEnquiriesLoading
    : isExistingLead
    ? isLeadsLoading
    : isPartiesLoading;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200"
      role="presentation"
      onClick={() => !isSaving && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full sm:max-w-xl max-h-[94vh] sm:max-h-[90vh] flex flex-col overflow-hidden rounded-t-3xl sm:rounded-2xl border border-border bg-card shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Indicator Handle */}
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
          <div className="h-1.5 w-12 rounded-full bg-border" />
        </div>

        <div className="flex items-center justify-between border-b border-border px-4 sm:px-5 py-3 sm:py-4 bg-surface-muted/30 shrink-0">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-foreground">
              {mode === "create" ? "Add Field Visit" : "Edit Field Visit"}
            </h2>
            <p className="text-[11px] sm:text-xs text-muted">
              {adminRole
                ? "Portal Admin — Assign visit for any portal member"
                : managerRole
                ? "Portal Manager — Assign visit for yourself or reporting team"
                : isPowerAudit
                ? "Power Audit — Schedule site audit facility & enquiry visits"
                : "Schedule your field visit details"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg p-1 text-muted hover:bg-surface-muted hover:text-foreground cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 px-4 sm:px-5 py-3.5 sm:py-4">
          {/* Date & Executive Assignment Bar within Scope */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-surface-muted/60 rounded-xl border border-border">
            <div>
              <label className={labelClass}>
                <Calendar className="inline h-3.5 w-3.5 mr-1 text-primary" />
                Plan Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={internalPlanDate}
                onChange={(e) => setInternalPlanDate(e.target.value)}
                disabled={isSaving}
                className={inputClass}
              />
              {errors.planDate && (
                <p className="mt-1 text-xs text-rose-500">{errors.planDate}</p>
              )}
            </div>

            <div>
              <label className={labelClass}>
                <User className="inline h-3.5 w-3.5 mr-1 text-primary" />
                Assign Executive / Team Member <span className="text-rose-500">*</span>
              </label>
              {elevatedRole ? (
                <select
                  value={internalSalesUserId}
                  onChange={(e) => setInternalSalesUserId(e.target.value)}
                  disabled={isSaving}
                  className={inputClass}
                >
                  {allowedExecutives.map((exec) => (
                    <option key={exec._id || exec.id} value={exec._id || exec.id}>
                      {exec.name} {exec._id === sessionUserId ? "(Self)" : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground">
                  {sessionUser?.name || "Self"} (Executive)
                </div>
              )}
            </div>
          </div>

          {/* Work Plan Detection Banner */}
          {internalPlanDate && (
            <div
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition ${
                planCompleted
                  ? "border-rose-500/40 bg-rose-50/80 dark:bg-rose-950/20 text-rose-800 dark:text-rose-300"
                  : existingPlan
                  ? "border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300"
                  : "border-border bg-surface-muted/40 text-muted"
              }`}
            >
              {isCheckingPlan ? (
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span>Checking for work plan…</span>
                </div>
              ) : planCompleted ? (
                <>
                  <Info className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <div>
                    <span className="font-semibold text-rose-900 dark:text-rose-200">
                      Work plan completed:
                    </span>{" "}
                    The work plan for {formatPlanDate(internalPlanDate)} is completed. New visits cannot be added to this day.
                  </div>
                </>
              ) : existingPlan ? (
                <>
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <span className="font-semibold text-emerald-900 dark:text-emerald-200">
                      Work Plan Found ({existingPlan.status || "planned"}):
                    </span>{" "}
                    This visit will be automatically added to the work plan for{" "}
                    {formatPlanDate(internalPlanDate)}.
                  </div>
                </>
              ) : (
                <>
                  <Info className="h-4 w-4 shrink-0 text-muted" />
                  <div>
                    <span className="font-medium text-foreground">No work plan for this date:</span>{" "}
                    This visit will be created as a standalone visit.
                  </div>
                </>
              )}
            </div>
          )}

          <div>
            <label className={labelClass}>
              Party Category / Type <span className="text-rose-500">*</span>
            </label>
            <div className={`grid gap-2 ${partyTypeOptions.length > 4 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-4"}`}>
              {partyTypeOptions.map((opt) => {
                const isSelected = partyType === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-xs font-semibold transition ${
                      isSelected
                        ? "border-primary bg-primary-muted text-primary shadow-xs"
                        : "border-border bg-surface-muted/50 text-muted hover:border-border hover:text-foreground"
                    } ${isSaving ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    <input
                      type="radio"
                      name="partyType"
                      value={opt.value}
                      checked={isSelected}
                      disabled={isSaving}
                      onChange={() => handlePartyTypeChange(opt.value)}
                      className="sr-only"
                    />
                    <div
                      className={`h-3.5 w-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                        isSelected ? "border-primary" : "border-border"
                      }`}
                    >
                      {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
                    </div>
                    <span className="truncate">{opt.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {isExistingType ? (
            <div className="relative space-y-1.5" ref={dropdownRef}>
              <label className={labelClass}>
                {searchLabel} <span className="text-rose-500">*</span>
              </label>

              {isExistingLead && !assignedExecutiveId ? (
                <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-blue-800">
                  Showing all accessible leads. Select an executive above to filter by specific assignee.
                </p>
              ) : null}

              {isExistingParty ? (
                <div className="space-y-1.5 rounded-lg border border-border/80 bg-surface-muted/30 p-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>Party Master Filter</span>
                      {stateName ? (
                        <span className="text-[11px] font-normal text-muted">
                          (State: <strong>{stateName}</strong>)
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2">
                      {filterCityNames.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setFilterCityIds([]);
                            setFilterCityNames([]);
                          }}
                          className="text-[10px] text-muted hover:text-rose-500 transition cursor-pointer"
                        >
                          Clear all cities
                        </button>
                      )}
                      {/* Popover trigger button to add/toggle cities */}
                      <div className="relative" ref={cityFilterDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setIsCityFilterOpen((prev) => !prev)}
                          disabled={isSaving || !stateId || isCitiesLoading}
                          className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/20 transition cursor-pointer disabled:opacity-50"
                        >
                          <Plus className="h-3 w-3" />
                          <span>Filter Cities</span>
                          <ChevronDown
                            className={`h-3 w-3 transition-transform ${isCityFilterOpen ? "rotate-180" : ""}`}
                          />
                        </button>

                        {/* City Filter Popover */}
                        {isCityFilterOpen && (
                          <div className="absolute right-0 top-full z-50 mt-1 max-h-64 w-60 rounded-xl border border-border bg-card shadow-xl overflow-hidden flex flex-col">
                            <div className="p-2 border-b border-border bg-surface-muted/50">
                              <div className="relative">
                                <Search className="absolute left-2 top-2 h-3 w-3 text-muted" />
                                <input
                                  type="text"
                                  placeholder="Search cities..."
                                  value={cityFilterSearch}
                                  onChange={(e) => setCityFilterSearch(e.target.value)}
                                  className="w-full rounded border border-border bg-card pl-7 pr-2 py-1 text-xs text-foreground outline-none focus:border-primary"
                                  autoFocus
                                />
                              </div>
                              <div className="flex items-center justify-between mt-1 px-0.5 text-[10px] text-muted">
                                <span>
                                  {
                                    citiesData.filter((c) =>
                                      c.name.toLowerCase().includes(cityFilterSearch.toLowerCase().trim())
                                    ).length
                                  }{" "}
                                  cities
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const matching = citiesData.filter((c) =>
                                        c.name.toLowerCase().includes(cityFilterSearch.toLowerCase().trim())
                                      );
                                      const newIds = Array.from(new Set([...filterCityIds, ...matching.map((c) => c._id || c.id || "")]));
                                      const newNames = citiesData.filter((c) => newIds.includes(c._id || c.id || "")).map((c) => c.name);
                                      setFilterCityIds(newIds);
                                      setFilterCityNames(newNames);
                                    }}
                                    className="text-primary hover:underline font-semibold cursor-pointer"
                                  >
                                    All
                                  </button>
                                  <span>•</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFilterCityIds([]);
                                      setFilterCityNames([]);
                                    }}
                                    className="text-rose-500 hover:underline cursor-pointer"
                                  >
                                    Clear
                                  </button>
                                </div>
                              </div>
                            </div>

                            <div className="overflow-y-auto max-h-40 p-1">
                              {citiesData
                                .filter((ci) =>
                                  ci.name.toLowerCase().includes(cityFilterSearch.toLowerCase().trim())
                                )
                                .map((ci) => {
                                  const id = ci._id || ci.id || "";
                                  const isChecked = filterCityIds.includes(id) || filterCityNames.some(n => n.toLowerCase() === ci.name.toLowerCase());
                                  return (
                                    <label
                                      key={id}
                                      className={`flex items-center gap-2 px-2 py-1 rounded text-xs cursor-pointer hover:bg-surface-muted transition select-none ${
                                        isChecked ? "bg-primary/10 text-primary font-medium" : "text-foreground"
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={(e) => {
                                          let nextIds: string[];
                                          let nextNames: string[];
                                          if (e.target.checked) {
                                            nextIds = [...filterCityIds, id];
                                          } else {
                                            nextIds = filterCityIds.filter((cid) => cid !== id);
                                          }
                                          nextNames = citiesData
                                            .filter((c) => nextIds.includes(c._id || c.id || ""))
                                            .map((c) => c.name);
                                          setFilterCityIds(nextIds);
                                          setFilterCityNames(nextNames);
                                        }}
                                        className="rounded border-border text-primary focus:ring-primary h-3 w-3"
                                      />
                                      <span className="flex-1 truncate">{ci.name}</span>
                                      {isChecked && <Check className="h-3 w-3 text-primary shrink-0" />}
                                    </label>
                                  );
                                })}
                              {citiesData.filter((ci) =>
                                ci.name.toLowerCase().includes(cityFilterSearch.toLowerCase().trim())
                              ).length === 0 && (
                                <div className="p-2 text-center text-xs text-muted">
                                  No cities found
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Active city filter chips */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {filterCityNames.length === 0 ? (
                      <span className="text-[11px] text-muted italic">
                        Showing parties across all cities in {stateName || "the selected state"}.
                      </span>
                    ) : (
                      <>
                        <span className="text-[10px] text-muted font-medium">Filtering by:</span>
                        {filterCityNames.map((name, idx) => (
                          <span
                            key={name + idx}
                            className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 pl-2 pr-1 py-0.5 text-[11px] font-semibold text-primary"
                          >
                            <span>{name}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const nextIds = filterCityIds.filter((_, i) => i !== idx);
                                const nextNames = filterCityNames.filter((_, i) => i !== idx);
                                setFilterCityIds(nextIds);
                                setFilterCityNames(nextNames);
                              }}
                              className="rounded p-0.5 hover:bg-primary/20 hover:text-primary transition cursor-pointer"
                              title={`Remove ${name} filter`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              ) : (isExistingParty || isExistingLead) && (cityName || stateName) ? (
                <div className="flex items-center gap-1.5 text-[11px] text-primary bg-primary/5 border border-primary/20 rounded-md px-2.5 py-1">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    Master scoped to location:{" "}
                    <strong>{[cityName, stateName].filter(Boolean).join(", ")}</strong>
                  </span>
                </div>
              ) : null}

              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchValue}
                  onFocus={() => {
                    if (isFacility) setFacilityDropdownOpen(true);
                    else if (isEnquiry) setEnquiryDropdownOpen(true);
                    else if (isExistingLead) setLeadDropdownOpen(true);
                    else setPartyDropdownOpen(true);
                  }}
                  onChange={(e) => {
                    const value = e.target.value;
                    setPartyName(value);
                    if (isFacility) {
                      setFacilitySearch(value);
                      if (!facilityDropdownOpen) setFacilityDropdownOpen(true);
                    } else if (isEnquiry) {
                      setEnquirySearch(value);
                      if (!enquiryDropdownOpen) setEnquiryDropdownOpen(true);
                    } else if (isExistingLead) {
                      setLeadSearch(value);
                      if (!leadDropdownOpen) setLeadDropdownOpen(true);
                    } else {
                      setPartySearch(value);
                      if (!partyDropdownOpen) setPartyDropdownOpen(true);
                    }
                  }}
                  disabled={isSaving}
                  className={`${inputClass} pl-9 pr-8`}
                />
                {partyName ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPartyName("");
                      setSelectedPartyId("");
                      setSelectedLeadId("");
                      setPartySearch("");
                      setLeadSearch("");
                      setFacilitySearch("");
                      setEnquirySearch("");
                    }}
                    className="absolute right-2.5 top-2.5 text-muted hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              {errors.partyName && (
                <p className="text-xs text-rose-500">{errors.partyName}</p>
              )}

              {dropdownOpen && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
                  {isSearchLoading ? (
                    <div className="p-3 text-center text-xs text-muted">Searching…</div>
                  ) : isFacility ? (
                    facilitiesData.length === 0 ? (
                      <div className="p-3 text-center text-xs text-muted">
                        No audit facilities found. You can switch to &quot;New Party&quot; to add manually.
                      </div>
                    ) : (
                      facilitiesData.map((facility: PowerFacility) => {
                        const fId = facility.id || facility._id || "";
                        const isSelected = selectedPartyId === fId;
                        return (
                          <div
                            key={fId}
                            onClick={() => handleSelectFacility(facility)}
                            className={`flex cursor-pointer items-start justify-between border-b border-border/50 p-2.5 text-xs hover:bg-surface-muted transition ${
                              isSelected ? "bg-primary/10" : ""
                            }`}
                          >
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground truncate">
                                  {facility.name}
                                </span>
                                {facility.audit_number ? (
                                  <span className="shrink-0 rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                                    {facility.audit_number}
                                  </span>
                                ) : null}
                                {facility.status ? (
                                  <span
                                    className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                                      facility.status === "active"
                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                        : "bg-zinc-500/10 text-zinc-500"
                                    }`}
                                  >
                                    {facility.status.toUpperCase()}
                                  </span>
                                ) : null}
                              </div>
                              <div className="text-muted text-[11px] flex flex-wrap items-center gap-x-2">
                                {facility.client_representative ? (
                                  <span>{facility.client_representative}</span>
                                ) : null}
                                {facility.client_contact_number ? (
                                  <span>• {facility.client_contact_number}</span>
                                ) : null}
                                {facility.audit_type ? (
                                  <span className="text-primary font-medium">
                                    • {facility.audit_type}
                                  </span>
                                ) : null}
                              </div>
                              {facility.address || facility.city ? (
                                <div className="text-muted/80 text-[11px] truncate">
                                  {[facility.address, facility.city]
                                    .filter(Boolean)
                                    .join(", ")}
                                </div>
                              ) : null}
                            </div>
                            {isSelected && (
                              <Check className="h-4 w-4 text-primary shrink-0 ml-2 mt-0.5" />
                            )}
                          </div>
                        );
                      })
                    )
                  ) : isEnquiry ? (
                    enquiriesData.length === 0 ? (
                      <div className="p-3 text-center text-xs text-muted">
                        No audit enquiries found. You can switch to &quot;New Party&quot; to add manually.
                      </div>
                    ) : (
                      enquiriesData.map((enquiry: PowerEnquiry) => {
                        const eId = enquiry.id || enquiry._id || "";
                        const isSelected = selectedPartyId === eId || selectedLeadId === eId;
                        return (
                          <div
                            key={eId}
                            onClick={() => handleSelectEnquiry(enquiry)}
                            className={`flex cursor-pointer items-start justify-between border-b border-border/50 p-2.5 text-xs hover:bg-surface-muted transition ${
                              isSelected ? "bg-primary/10" : ""
                            }`}
                          >
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground truncate">
                                  {enquiry.name}
                                </span>
                                {enquiry.enquiry_number ? (
                                  <span className="shrink-0 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                    {enquiry.enquiry_number}
                                  </span>
                                ) : null}
                                {enquiry.enquiry_status ? (
                                  <span className="shrink-0 rounded-md bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase">
                                    {enquiry.enquiry_status}
                                  </span>
                                ) : null}
                              </div>
                              <div className="text-muted text-[11px] flex flex-wrap items-center gap-x-2">
                                {enquiry.client_representative ? (
                                  <span>{enquiry.client_representative}</span>
                                ) : null}
                                {enquiry.client_contact_number ? (
                                  <span>• {enquiry.client_contact_number}</span>
                                ) : null}
                                {Array.isArray(enquiry.requested_audit_types) &&
                                enquiry.requested_audit_types.length > 0 ? (
                                  <span className="text-primary font-medium">
                                    • {enquiry.requested_audit_types.join(", ")}
                                  </span>
                                ) : null}
                              </div>
                              {enquiry.address || enquiry.city ? (
                                <div className="text-muted/80 text-[11px] truncate">
                                  {[enquiry.address, enquiry.city]
                                    .filter(Boolean)
                                    .join(", ")}
                                </div>
                              ) : null}
                            </div>
                            {isSelected && (
                              <Check className="h-4 w-4 text-primary shrink-0 ml-2 mt-0.5" />
                            )}
                          </div>
                        );
                      })
                    )
                  ) : isExistingLead ? (
                    leadsData.length === 0 ? (
                      <div className="p-3 text-center text-xs text-muted">
                        No leads found. You can switch to &quot;New Party&quot; to add manually.
                      </div>
                    ) : (
                      leadsData.map((lead: LeadRecord) => {
                        const lId = lead._id || lead.id || "";
                        const primary = primaryLeadContact(lead);
                        const isSelected = selectedLeadId === lId;
                        return (
                          <div
                            key={lId}
                            onClick={() => handleSelectLead(lead)}
                            className={`flex cursor-pointer items-start justify-between border-b border-border/50 p-2.5 text-xs hover:bg-surface-muted transition ${
                              isSelected ? "bg-primary/10" : ""
                            }`}
                          >
                            <div className="space-y-0.5 min-w-0 flex-1">
                              <div className="font-semibold text-foreground truncate">
                                {leadDisplayName(lead)}
                              </div>
                              {primary?.name ? (
                                <div className="text-muted text-[11px] truncate">
                                  {primary.name}
                                  {primary.phone ? ` • ${primary.phone}` : ""}
                                </div>
                              ) : null}
                              {formatLeadAddress(lead) ? (
                                <div className="text-muted/80 text-[11px] truncate">
                                  {formatLeadAddress(lead)}
                                </div>
                              ) : null}
                            </div>
                            {isSelected && (
                              <Check className="h-4 w-4 text-primary shrink-0 ml-2 mt-0.5" />
                            )}
                          </div>
                        );
                      })
                    )
                  ) : filteredParties.length === 0 ? (
                    <div className="p-3 text-center text-xs text-muted space-y-1.5">
                      <div>
                        No parties found
                        {filterCityNames.length > 0
                          ? ` in selected cities (${filterCityNames.join(", ")})`
                          : ""}
                        .
                      </div>
                      {filterCityNames.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setFilterCityIds([]);
                            setFilterCityNames([]);
                          }}
                          className="text-xs text-primary font-semibold hover:underline cursor-pointer"
                        >
                          Clear city filters to show all parties in {stateName || "State"}
                        </button>
                      )}
                      <div>
                        Or switch to &quot;New Party&quot; to add a new client manually.
                      </div>
                    </div>
                  ) : (
                    filteredParties.map((party: PartyRecord) => {
                      const pId = party._id || party.id || "";
                      const isSelected = selectedPartyId === pId;
                      const partyCity =
                        party.city ||
                        (party.billing_address as any)?.city ||
                        (party.shipping_address as any)?.city ||
                        party.district;
                      return (
                        <div
                          key={pId}
                          onClick={() => handleSelectParty(party)}
                          className={`flex cursor-pointer items-start justify-between border-b border-border/50 p-2.5 text-xs hover:bg-surface-muted transition ${
                            isSelected ? "bg-primary/10" : ""
                          }`}
                        >
                          <div className="space-y-0.5 min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-foreground truncate">
                                {party.party_name}
                              </span>
                              {partyCity && (
                                <span className="inline-flex items-center rounded bg-primary/10 px-1.5 py-0.2 text-[10px] font-medium text-primary">
                                  {partyCity}
                                </span>
                              )}
                            </div>
                            {party.contact_person ? (
                              <div className="text-muted text-[11px] truncate">
                                {party.contact_person}
                                {party.mobile ? ` • ${party.mobile}` : ""}
                              </div>
                            ) : null}
                            {formatPartyAddress(party) ? (
                              <div className="text-muted/80 text-[11px] truncate">
                                {formatPartyAddress(party)}
                              </div>
                            ) : null}
                          </div>
                          {isSelected && (
                            <Check className="h-4 w-4 text-primary shrink-0 ml-2 mt-0.5" />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className={labelClass}>
                Party / Company Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={partyName}
                onChange={(e) => setPartyName(e.target.value)}
                placeholder="e.g. Apex Health Systems"
                disabled={isSaving}
                className={inputClass}
              />
              {errors.partyName && (
                <p className="mt-1 text-xs text-rose-500">{errors.partyName}</p>
              )}
            </div>
          )}

          {/* Contacts Section */}
          <div className="space-y-3 rounded-xl border border-border bg-surface-muted/40 p-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold text-foreground">
                  Contacts / People Met ({contacts.length})
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddContact}
                disabled={isSaving}
                className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Contact</span>
              </button>
            </div>

            {errors.contacts && (
              <p className="text-xs text-rose-500 font-medium">{errors.contacts}</p>
            )}

            <div className="space-y-3">
              {contacts.map((contact, idx) => (
                <div
                  key={contact.id}
                  className="rounded-lg border border-border bg-card p-3 space-y-2.5 relative shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                          idx === 0
                            ? "bg-primary/15 text-primary"
                            : "bg-surface-muted text-muted"
                        }`}
                      >
                        {idx === 0 ? "Primary Contact" : `Contact #${idx + 1}`}
                      </span>
                      {contact.designation && (
                        <span className="text-[10px] text-muted italic">
                          ({contact.designation})
                        </span>
                      )}
                    </div>
                    {contacts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveContact(idx)}
                        disabled={isSaving}
                        className="rounded p-1 text-muted hover:bg-rose-500/10 hover:text-rose-600 transition cursor-pointer"
                        title="Remove contact"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-muted">
                        Contact Person Name <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <User className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted" />
                        <input
                          type="text"
                          value={contact.contact_person}
                          onChange={(e) =>
                            handleContactChange(idx, "contact_person", e.target.value)
                          }
                          placeholder="Dr. Rajesh Gupta / Mr. Sharma"
                          disabled={isSaving}
                          className={`${inputClass} pl-8 text-xs`}
                        />
                      </div>
                      {errors[`contactPerson_${idx}`] && (
                        <p className="mt-1 text-[11px] text-rose-500">
                          {errors[`contactPerson_${idx}`]}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-muted">
                        Contact Phone / Mobile <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted" />
                        <input
                          type="tel"
                          value={contact.contact_number}
                          onChange={(e) =>
                            handleContactChange(idx, "contact_number", e.target.value)
                          }
                          placeholder="9876543210"
                          disabled={isSaving}
                          className={`${inputClass} pl-8 text-xs`}
                        />
                      </div>
                      {errors[`contactNumber_${idx}`] && (
                        <p className="mt-1 text-[11px] text-rose-500">
                          {errors[`contactNumber_${idx}`]}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-muted">
                      Contact Email (Optional)
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted" />
                      <input
                        type="email"
                        value={contact.contact_email}
                        onChange={(e) =>
                          handleContactChange(idx, "contact_email", e.target.value)
                        }
                        placeholder="contact@client.com"
                        disabled={isSaving}
                        className={`${inputClass} pl-8 text-xs`}
                      />
                    </div>
                    {errors[`contactEmail_${idx}`] && (
                      <p className="mt-1 text-[11px] text-rose-500">
                        {errors[`contactEmail_${idx}`]}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Geography & Location Section */}
          <div className="space-y-3 rounded-xl border border-border bg-surface-muted/30 p-3.5">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold text-foreground">
                Location & Geography (Party Master)
              </span>
            </div>

            {/* Country / State / City 3-column selector */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>
                  Country <span className="text-rose-500">*</span>
                </label>
                <select
                  value={countryId}
                  onChange={(e) => {
                    const cId = e.target.value;
                    setCountryId(cId);
                    const found = countriesData.find((c) => c._id === cId || c.id === cId);
                    setCountryName(found?.name || "");
                    setStateId("");
                    setStateName("");
                    setCityId("");
                    setCityName("");
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.country;
                      delete next.state;
                      delete next.city;
                      return next;
                    });
                  }}
                  disabled={isSaving || isCountriesLoading}
                  className={`${inputClass} ${
                    errors.country ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20" : ""
                  }`}
                >
                  <option value="">
                    {isCountriesLoading ? "Loading countries..." : "Select Country"}
                  </option>
                  {countriesData.map((c) => {
                    const id = c._id || c.id || "";
                    return (
                      <option key={id} value={id}>
                        {c.name}
                      </option>
                    );
                  })}
                </select>
                {errors.country && (
                  <p className="mt-1 text-[11px] text-rose-500">{errors.country}</p>
                )}
              </div>

              <div>
                <label className={labelClass}>
                  State / Province <span className="text-rose-500">*</span>
                </label>
                <select
                  value={stateId}
                  onChange={(e) => {
                    const sId = e.target.value;
                    setStateId(sId);
                    const found = statesData.find((s) => s._id === sId || s.id === sId);
                    setStateName(found?.name || "");
                    setCityId("");
                    setCityName("");
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.state;
                      delete next.city;
                      return next;
                    });
                  }}
                  disabled={isSaving || !countryId || isStatesLoading}
                  className={`${inputClass} ${
                    errors.state ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20" : ""
                  }`}
                >
                  <option value="">
                    {!countryId
                      ? "Select Country first"
                      : isStatesLoading
                      ? "Loading states..."
                      : "Select State"}
                  </option>
                  {countryId &&
                    statesData.map((s) => {
                      const id = s._id || s.id || "";
                      return (
                        <option key={id} value={id}>
                          {s.name}
                        </option>
                      );
                    })}
                </select>
                {errors.state && (
                  <p className="mt-1 text-[11px] text-rose-500">{errors.state}</p>
                )}
              </div>

              <div>
                <label className={labelClass}>
                  City / District <span className="text-rose-500">*</span>
                </label>
                <select
                  value={cityId}
                  onChange={(e) => {
                    const ciId = e.target.value;
                    setCityId(ciId);
                    const found = citiesData.find((ci) => ci._id === ciId || ci.id === ciId);
                    setCityName(found?.name || "");
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.city;
                      return next;
                    });
                  }}
                  disabled={isSaving || !stateId || isCitiesLoading}
                  className={`${inputClass} ${
                    errors.city ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20" : ""
                  }`}
                >
                  <option value="">
                    {!stateId
                      ? "Select State first"
                      : isCitiesLoading
                      ? "Loading cities..."
                      : "Select City"}
                  </option>
                  {stateId &&
                    citiesData.map((ci) => {
                      const id = ci._id || ci.id || "";
                      const isSuggested =
                        filterCityIds.includes(id) ||
                        filterCityNames.some(
                          (n) => n.toLowerCase().trim() === ci.name.toLowerCase().trim()
                        );
                      return (
                        <option key={id} value={id}>
                          {ci.name}
                          {isSuggested ? " ★ (Plan City)" : ""}
                        </option>
                      );
                    })}
                </select>
                {errors.city && (
                  <p className="mt-1 text-[11px] text-rose-500">{errors.city}</p>
                )}
              </div>
            </div>

            {/* Street Address and GSTIN */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className={labelClass}>Street Address / Premises (Optional)</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. 4th Floor, Apex Tower, Ring Road"
                  disabled={isSaving}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>GSTIN / Tax ID (Optional)</label>
                <input
                  type="text"
                  value={gstNo}
                  onChange={(e) => setGstNo(e.target.value.toUpperCase())}
                  placeholder="27AAAAA0000A1Z5"
                  disabled={isSaving}
                  className={`${inputClass} font-mono uppercase`}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Planned Start Time</label>
              <input
                type="time"
                value={plannedStartTime}
                onChange={(e) => setPlannedStartTime(e.target.value)}
                disabled={isSaving}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Planned End Time</label>
              <input
                type="time"
                value={plannedEndTime}
                onChange={(e) => setPlannedEndTime(e.target.value)}
                disabled={isSaving}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Purpose / Objective</label>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. Product Demo, Order collection, Follow-up meeting..."
              disabled={isSaving}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Notes (Optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any preparatory notes, reference quotes, or key discussion points"
              disabled={isSaving}
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2 border-t border-border px-4 sm:px-5 py-3 sm:py-3.5 bg-surface-muted/30 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="w-full sm:w-auto rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-surface-muted active:scale-[0.98] transition cursor-pointer text-center"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isCheckingPlan || planCompleted}
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary-hover active:scale-[0.98] shadow-md transition cursor-pointer"
          >
            {isSaving ? "Saving…" : mode === "create" ? "Add Visit" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default VisitFormModal;
