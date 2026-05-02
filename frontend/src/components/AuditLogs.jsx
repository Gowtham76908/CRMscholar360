import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, FileText, User, Filter, AlertCircle } from "lucide-react";
import api from "../api/axios";

const AuditLogs = () => {
    const [filter, setFilter] = useState("ALL"); // ALL, USER, LEAD, SYSTEM

    // Pagination could be added later, currently basic list
    const { data: logs, isLoading } = useQuery({
        queryKey: ["audit-logs"],
        queryFn: async () => {
            const res = await api.get("/audit-logs");
            return res.data;
        }
    });

    const filteredLogs = logs?.filter(log => {
        if (filter === "ALL") return true;
        return log.entityType === filter;
    });

    return (
        <div className="bg-white shadow rounded-lg p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div>
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Audit Logs</h3>
                    <p className="text-sm text-gray-500 mt-1">Track system-wide activities and security events.</p>
                </div>
                <div className="relative w-full sm:w-48">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <select
                        className="pl-10 w-full border border-gray-300 rounded-lg py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                    >
                        <option value="ALL">All Events</option>
                        <option value="USER">User Events</option>
                        <option value="LEAD">Lead Events</option>
                        <option value="SYSTEM">System Events</option>
                    </select>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                </div>
            ) : (
                <div className="flow-root">
                    <ul className="-my-5 divide-y divide-gray-200">
                        {filteredLogs?.map((log) => (
                            <li key={log.id} className="py-4 hover:bg-gray-50 -mx-6 px-6 transition-colors">
                                <div className="flex items-center space-x-4">
                                    <div className="flex-shrink-0">
                                        <span className={`inline-flex items-center justify-center h-8 w-8 rounded-full 
                                            ${log.action.includes("DELETE") ? "bg-red-100 ring-4 ring-white" : "bg-gray-100 ring-4 ring-white"}`}>
                                            {log.action.includes("DELETE") ? <AlertCircle className="h-4 w-4 text-red-600" /> : <FileText className="h-4 w-4 text-gray-500" />}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">
                                            {log.user?.name || "System"} <span className="text-gray-500 font-normal">performed</span> {log.action.replace(/_/g, " ")}
                                        </p>
                                        <p className="text-sm text-gray-500 truncate">
                                            Target: {log.entityType} #{log.entityId}
                                        </p>
                                        {log.details && (
                                            <p className="text-xs text-gray-400 mt-0.5 truncate font-mono">
                                                {JSON.stringify(log.details)}
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                            {new Date(log.createdAt).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </li>
                        ))}
                        {filteredLogs?.length === 0 && (
                            <li className="py-8 text-center text-gray-500 text-sm">
                                No logs found matching this filter.
                            </li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default AuditLogs;
