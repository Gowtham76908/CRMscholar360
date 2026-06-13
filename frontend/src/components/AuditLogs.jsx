import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, FileText, Filter, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import api from "../api/axios";

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

const dateLabel = (d) => {
    const day = startOfDay(d);
    const today = startOfDay(new Date());
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    if (day.getTime() === today.getTime()) return "Today";
    if (day.getTime() === yesterday.getTime()) return "Yesterday";
    return day.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
};

const AuditLogs = () => {
    const [filter, setFilter] = useState("ALL"); // ALL, USER, LEAD, SYSTEM
    const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));

    const isToday = startOfDay(selectedDate).getTime() === startOfDay(new Date()).getTime();

    const { data: logs, isLoading } = useQuery({
        queryKey: ["audit-logs", ymd(selectedDate)],
        queryFn: async () => {
            const res = await api.get("/audit-logs", { params: { date: ymd(selectedDate) } });
            return res.data;
        },
        keepPreviousData: true,
    });

    const filteredLogs = logs?.filter(log => {
        if (filter === "ALL") return true;
        return log.entityType === filter;
    });

    const shiftDay = (delta) => {
        setSelectedDate(prev => {
            const next = new Date(prev);
            next.setDate(prev.getDate() + delta);
            return startOfDay(next);
        });
    };

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

            {/* Date navigator */}
            <div className="flex items-center justify-between gap-3 mb-5 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => shiftDay(-1)}
                        className="p-1.5 text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50"
                        title="Previous day"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                        onClick={() => shiftDay(1)}
                        disabled={isToday}
                        className="p-1.5 text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Next day"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                    <div className="ml-1">
                        <p className="text-sm font-bold text-gray-900">{dateLabel(selectedDate)}</p>
                        <p className="text-[11px] text-gray-400">
                            {isLoading ? "Loading…" : `${filteredLogs?.length ?? 0} event${(filteredLogs?.length ?? 0) === 1 ? "" : "s"}`}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type="date"
                        value={ymd(selectedDate)}
                        max={ymd(new Date())}
                        onChange={(e) => e.target.value && setSelectedDate(startOfDay(new Date(e.target.value)))}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                    {!isToday && (
                        <button
                            onClick={() => setSelectedDate(startOfDay(new Date()))}
                            className="px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                        >
                            Today
                        </button>
                    )}
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                </div>
            ) : filteredLogs?.length === 0 ? (
                <div className="py-12 text-center text-gray-500 text-sm">
                    No activity recorded {isToday ? "today" : `on ${dateLabel(selectedDate)}`}.
                </div>
            ) : (
                <div className="flow-root">
                    <ul className="divide-y divide-gray-100">
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
                                            {new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                        </span>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default AuditLogs;
