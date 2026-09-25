import { requireVerifiedUser } from "@/lib/auth-guard";
import DashboardClient from "./_components/dashboard-client";

export default async function DashboardPage() {
  const user = await requireVerifiedUser();
  return <DashboardClient fullName={user.fullName} email={user.email} />;
}
