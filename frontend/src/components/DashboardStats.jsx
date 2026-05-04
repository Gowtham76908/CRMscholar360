import { Users, UserPlus, CheckCircle, TrendingUp } from "lucide-react";
import { cn } from "../lib/utils";

const StatCard = ({ title, value, subtext, icon: Icon, colorClass }) => {
    return (
        <div className="bg-white overflow-hidden rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="p-5">
                <div className="flex items-center">
                    <div className="flex-shrink-0">
                        <div className={cn("p-3 rounded-lg", colorClass)}>
                            <Icon className="h-6 w-6 text-white" />
                        </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                        <dl>
                            <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
                            <dd>
                                <div className="text-2xl font-bold text-gray-900">{value}</div>
                            </dd>
                            {subtext && (
                                <dd className="flex items-baseline">
                                    <p className="text-sm text-green-600 font-medium">
                                        {subtext}
                                    </p>
                                </dd>
                            )}
                        </dl>
                    </div>
                </div>
            </div>
        </div>
    );
};

const DashboardStats = ({ stats = {} }) => {
    const { 
        totalLeads = 0, 
        newLeadsToday = 0, 
        convertedLeads = 0, 
        pendingTasks = 0, 
        conversionRate = 0 
    } = stats;

    return (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
                title="Total Leads"
                value={totalLeads}
                icon={Users}
                colorClass="bg-indigo-600"
            />
            <StatCard
                title="New Today"
                value={newLeadsToday}
                subtext={newLeadsToday > 0 ? "Potential opportunities" : "No new leads"}
                icon={UserPlus}
                colorClass="bg-blue-500"
            />
            <StatCard
                title="Converted"
                value={convertedLeads}
                icon={CheckCircle}
                colorClass="bg-emerald-500"
            />
            <StatCard
                title="Conversion Rate"
                value={`${conversionRate}%`}
                subtext="Overall performance"
                icon={TrendingUp}
                colorClass="bg-purple-500"
            />
        </div>
    );
};

export default DashboardStats;
