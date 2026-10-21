import { AssignedUsersPage } from "@/components/workPlanner/AssignedUsersPage";

export const metadata = {
  title: "My Team - Work Planner",
  description: "Manager view for direct reports, team work plans, and pending expense approvals.",
};

export default function Page() {
  return <AssignedUsersPage mode="my-team" />;
}
