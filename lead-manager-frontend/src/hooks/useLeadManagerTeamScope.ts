"use client";

import { useCallback, useMemo } from "react";
import { useGetMyTeamQuery } from "@/store/api/slices/teamApi";
import { useLeadManagerRole } from "@/hooks/useLeadManagerRole";

type IdLike = { _id?: string; id?: string };

/**
 * Reporting downline scope for Lead Manager forms (assignee, signatory, sales rep).
 * Admins: no filter (null set). Managers/coordinators: visible_user_ids from /team/my-team.
 */
export function useLeadManagerTeamScope() {
  const { isAdmin, isManager, isCoordinator, user, loading: roleLoading } = useLeadManagerRole();
  const useTeamApi = isManager || isCoordinator;

  const { data: myTeam, isLoading: teamLoading } = useGetMyTeamQuery(undefined, {
    skip: !useTeamApi,
  });

  const teamUserIds = useMemo(() => {
    if (isAdmin) return null;
    if (!useTeamApi) {
      return user?._id ? new Set([String(user._id)]) : new Set<string>();
    }
    const fromApi = myTeam?.visible_user_ids;
    if (fromApi && fromApi.length > 0) {
      return new Set(fromApi.map(String));
    }
    const fromMembers = (myTeam?.members || []).map((m) => String(m._id));
    return new Set(fromMembers);
  }, [isAdmin, useTeamApi, myTeam, user]);

  const filterByTeam = useCallback(
    <T extends IdLike>(list: T[]): T[] => {
      if (teamUserIds === null) return list;
      if (teamUserIds.size === 0) return list;
      return list.filter((row) => teamUserIds.has(String(row._id ?? row.id ?? "")));
    },
    [teamUserIds]
  );

  const withSelfInList = useCallback(
    <T extends IdLike>(list: T[], selfRow?: T | null): T[] => {
      if (!user?._id || teamUserIds === null) return list;
      const selfId = String(user._id);
      if (list.some((row) => String(row._id ?? row.id) === selfId)) return list;
      if (selfRow) return [selfRow, ...list];
      return list;
    },
    [user, teamUserIds]
  );

  return {
    isAdmin,
    isManager,
    isCoordinator,
    user,
    teamUserIds,
    filterByTeam,
    withSelfInList,
    canAssignWithinTeam: isAdmin || isManager || isCoordinator,
    loading: roleLoading || (useTeamApi && teamLoading),
  };
}
