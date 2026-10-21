import { medicaApi } from "../baseApi";
import { unwrapEnvelope, type ApiEnvelope } from "../unwrap";

export interface LeadManagerPortalAccess {
  portal_code?: string;
  portal?: string;
  access_roles?: string[];
}

export interface TeamMember {
  _id: string;
  id?: string;
  name: string;
  email: string;
  department?: string | { name?: string; _id?: string };
  role?: string;
  portals?: LeadManagerPortalAccess[];
  leadRole?: string;
  wp_role?: string;
  reports_to?: string | null;
  manager_ids?: string[];
  report_ids?: string[];
  managers?: TeamMember[];
  reports?: TeamMember[];
  is_active?: boolean;
}

export interface TeamReportingEdgeRow {
  subordinate: string;
  manager: string;
  subordinate_role?: string;
  manager_role?: string;
  is_active?: boolean;
}

export interface TeamTreeUser extends TeamMember {
  wp_role: string;
  manager_ids: string[];
  report_ids: string[];
}

export interface TeamTreeResponse {
  users: TeamTreeUser[];
  edges: TeamReportingEdgeRow[];
  admins: TeamMember[];
  managers: TeamMember[];
  coordinators: TeamMember[];
  executives: TeamMember[];
  unassignedManagers: TeamMember[];
  unassignedCoordinators: TeamMember[];
  unassignedExecutives: TeamMember[];
}

export interface MyTeamResponse {
  self_id: string;
  is_admin: boolean;
  is_manager: boolean;
  is_coordinator: boolean;
  members: Array<TeamMember & { wp_role?: string }>;
  edges: Array<{
    _id: string;
    subordinate: TeamMember;
    manager: TeamMember;
    is_active: boolean;
  }>;
  visible_user_ids: string[] | null;
}

export const teamApi = medicaApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (builder) => ({
    getTeamTree: builder.query<TeamTreeResponse, void>({
      query: () => "team/tree",
      transformResponse: (raw: ApiEnvelope<TeamTreeResponse>) => unwrapEnvelope(raw),
      providesTags: ["LeadTeam"],
    }),
    getMyTeam: builder.query<MyTeamResponse, void>({
      query: () => "team/my-team",
      transformResponse: (raw: ApiEnvelope<MyTeamResponse>) => unwrapEnvelope(raw),
      providesTags: ["LeadTeam"],
    }),
    listTeamEdges: builder.query<any[], void>({
      query: () => "team/edges",
      transformResponse: (raw: ApiEnvelope<any[]>) => unwrapEnvelope(raw),
      providesTags: ["LeadTeam"],
    }),
    upsertTeamEdge: builder.mutation<any, { subordinate: string; manager: string }>({
      query: (body) => ({
        url: "team/edges",
        method: "PUT",
        body,
      }),
      transformResponse: (raw: ApiEnvelope<any>) => unwrapEnvelope(raw),
      invalidatesTags: ["LeadTeam", "Users"],
    }),
    removeTeamEdge: builder.mutation<any, string | { subordinateId: string; managerId?: string }>({
      query: (arg) => {
        const subordinateId = typeof arg === "string" ? arg : arg.subordinateId;
        const managerId = typeof arg === "object" ? arg.managerId : undefined;
        return {
          url: `team/edges/${subordinateId}${
            managerId ? `?manager=${encodeURIComponent(managerId)}` : ""
          }`,
          method: "DELETE",
        };
      },
      transformResponse: (raw: ApiEnvelope<any>) => unwrapEnvelope(raw),
      invalidatesTags: ["LeadTeam", "Users"],
    }),
  }),
});

export const {
  useGetTeamTreeQuery,
  useGetMyTeamQuery,
  useListTeamEdgesQuery,
  useUpsertTeamEdgeMutation,
  useRemoveTeamEdgeMutation,
} = teamApi;
