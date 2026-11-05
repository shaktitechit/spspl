import { AssignedUsersPage } from "@/components/workPlanner/settings/AssignedUsersPage";

export const metadata = {
  description: "Admin view for all Work Planner teams, work plans, and expense activity.",
};

export default function Page() {
  return <AssignedUsersPage mode="assigned-teams" />;
}
