import { useQuery } from "@tanstack/react-query";
import api from "../api/axios";
import DashboardStats from "../components/DashboardStats";
import { Loader2 } from "lucide-react";

const Dashboard = () => {
    // Fetch Leads
    const { data: leads, isLoading: leadsLoading, error: leadsError } = useQuery({
        queryKey: ["leads"],
        queryFn: async () => {
            const res = await api.get("/leads");
            return res.data.data || res.data;
        },
    });

    const { data: tasks, isLoading: tasksLoading, error: tasksError } = useQuery({
        queryKey: ["tasks"],
        queryFn: async () => {
            const res = await api.get("/tasks");
            return res.data;
        },
    });

    if (leadsLoading || tasksLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    if (leadsError || tasksError) {
        return (
            <div className="flex items-center justify-center h-64 text-center">
                <div>
                    <p className="text-red-600 font-semibold">Failed to load dashboard data.</p>
                    <p className="text-gray-500 text-sm mt-1">Please refresh the page.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
                <p className="text-sm text-gray-500">Overview of your CRM activities</p>
            </header>

            <DashboardStats leads={leads} tasks={tasks} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Leads */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Leads</h2>
                    <div className="space-y-4">
                        {leads?.slice(0, 5).map((lead) => (
                            <div key={lead.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100 hover:bg-gray-100 transition-colors">
                                <div>
                                    <p className="text-sm font-medium text-gray-900">{lead.name}</p>
                                    <p className="text-xs text-gray-500">{lead.email}</p>
                                </div>
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium 
                                    ${lead.status === 'NEW' ? 'bg-blue-100 text-blue-800' :
                                        lead.status === 'CONVERTED' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                    {lead.status}
                                </span>
                            </div>
                        ))}
                        {leads?.length === 0 && <p className="text-sm text-gray-500">No recent leads found.</p>}
                    </div>
                </div>

                {/* Pending Tasks */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Pending Tasks</h2>
                    <div className="space-y-4">
                        {tasks?.filter(t => t.status === 'PENDING').slice(0, 5).map((task) => (
                            <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                                <div>
                                    <p className="text-sm font-medium text-gray-900">{task.title}</p>
                                    <p className="text-xs text-gray-500">Due: {new Date(task.dueDate).toLocaleDateString()}</p>
                                </div>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                    Pending
                                </span>
                            </div>
                        ))}
                        {tasks?.filter(t => t.status === 'PENDING').length === 0 && <p className="text-sm text-gray-500">No pending tasks.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
