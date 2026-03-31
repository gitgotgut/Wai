import { CostSummary } from "@/components/dashboard/CostSummary";
import { UsageChart } from "@/components/dashboard/UsageChart";
import { RecentConversations } from "@/components/dashboard/RecentConversations";

export default function DashboardPage() {
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <CostSummary />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <UsageChart />
        <RecentConversations />
      </div>
    </div>
  );
}
