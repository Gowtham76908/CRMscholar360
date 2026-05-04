import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, TrendingUp, PieChart as PieIcon, Users, Shield, Loader2 } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

const Reports = () => {
    const { user: currentUser } = useAuth();
    const [dateRange, setDateRange] = useState({ from: "", to: "" });

    const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(currentUser?.role);

    // Fetch Analytics Data (Only if Admin)
    const { data: leadsBySource, isLoading: loadingSource } = useQuery({
        queryKey: ["leads-by-source", dateRange],
        queryFn: async () => (await api.get("/reports/leads-by-source", { params: dateRange })).data,
        enabled: isAdmin
    });

    const { data: monthlyGrowth, isLoading: loadingGrowth } = useQuery({
        queryKey: ["monthly-growth"],
        queryFn: async () => (await api.get("/reports/monthly-growth")).data,
        enabled: isAdmin
    });

    const { data: conversionData, isLoading: loadingConversion } = useQuery({
        queryKey: ["conversion-rate", dateRange],
        queryFn: async () => (await api.get("/reports/conversion-rate", { params: dateRange })).data,
        enabled: isAdmin
    });

    const { data: teamPerformance, isLoading: loadingTeam } = useQuery({
        queryKey: ["team-performance"],
        queryFn: async () => (await api.get("/analytics/team-performance")).data,
        enabled: isAdmin
    });

    const isLoading = loadingSource || loadingGrowth || loadingConversion || loadingTeam;

    const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

    const handleExport = async (type) => {
        try {
            const response = await api.get(`/export/${type}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${type}.csv`);
            document.body.appendChild(link);
            link.click();
        } catch (error) {
            console.error("Export failed:", error);
            alert("Export failed");
        }
    };

    if (!isAdmin) {
        return (
            <div className="text-center py-20">
                <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-gray-900">Access Denied</h2>
                <p className="text-gray-500 mt-2">Only Admins can view reports and analytics.</p>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Reports & Analytics</h1>
                    <p className="text-sm text-gray-500">Track performance, growth, and team stats</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => handleExport("leads")} className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                        <Download className="h-4 w-4 mr-2" /> Leads CSV
                    </button>
                    <button onClick={() => handleExport("tasks")} className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                        <Download className="h-4 w-4 mr-2" /> Tasks CSV
                    </button>
                </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <div className="bg-white overflow-hidden rounded-xl border border-gray-200 shadow-sm p-5">
                    <div className="flex items-center">
                        <div className="flex-shrink-0 bg-indigo-100 rounded-md p-3">
                            <Users className="h-6 w-6 text-indigo-600" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                            <dl>
                                <dt className="text-sm font-medium text-gray-500 truncate">Total Leads</dt>
                                <dd className="text-2xl font-semibold text-gray-900">{conversionData?.totalLeads || 0}</dd>
                            </dl>
                        </div>
                    </div>
                </div>

                <div className="bg-white overflow-hidden rounded-xl border border-gray-200 shadow-sm p-5">
                    <div className="flex items-center">
                        <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
                            <TrendingUp className="h-6 w-6 text-green-600" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                            <dl>
                                <dt className="text-sm font-medium text-gray-500 truncate">Conversion Rate</dt>
                                <dd className="text-2xl font-semibold text-gray-900">{conversionData?.conversionRate || "0%"}</dd>
                            </dl>
                        </div>
                    </div>
                </div>

                <div className="bg-white overflow-hidden rounded-xl border border-gray-200 shadow-sm p-5">
                    <div className="flex items-center">
                        <div className="flex-shrink-0 bg-amber-100 rounded-md p-3">
                            <PieIcon className="h-6 w-6 text-amber-600" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                            <dl>
                                <dt className="text-sm font-medium text-gray-500 truncate">Converted Leads</dt>
                                <dd className="text-2xl font-semibold text-gray-900">{conversionData?.convertedLeads || 0}</dd>
                            </dl>
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Leads by Source */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 min-h-[300px]">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Leads by Source</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={leadsBySource}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="_count.id"
                                    nameKey="source"
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                >
                                    {leadsBySource?.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Monthly Growth */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 min-h-[300px]">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Monthly Growth</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyGrowth}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="month" />
                                <YAxis />
                                <RechartsTooltip />
                                <Bar dataKey="leads" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Team Performance Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="text-lg font-medium text-gray-900">Team Performance</h3>
                    <button onClick={() => handleExport("team-performance")} className="text-sm text-indigo-600 hover:text-indigo-900">
                        Export CSV
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Leads</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Converted</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Win Rate</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pending Tasks</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Response</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {teamPerformance?.map((member) => (
                                <tr key={member.userId} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{member.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{member.totalLeads}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{member.convertedLeads}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                            ${parseInt(member.conversionRate) > 20 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                            {member.conversionRate}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{member.pendingTasks}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{member.avgResponseTimeHours}h</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Reports;
