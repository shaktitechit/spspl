import { UserSettingsPage } from "@/components/workPlanner/UserSettingsPage";

export const metadata = {
  title: "User Settings - Work Planner",
  description: "Configure user manager, CC emails, and custom work task templates.",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <UserSettingsPage userId={id} />;
}
