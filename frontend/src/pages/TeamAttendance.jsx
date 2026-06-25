import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import {
    Users, Calendar, ChevronLeft, ChevronRight, ChevronDown, Loader2, Search,
    CheckCircle, Home, UserX, Plane, Clock, AlertCircle, ArrowLeft,
} from "lucide-react";

const isManager = (role) => role === "SUPER_ADMIN" || role === "ADMIN";

// Editable statuses — must match the AttendanceStatus enum in the Prisma schema.
const STATUSES = ["PRESENT", "WFH", "ABSENT", "LEAVE", "HALF_DAY"];

const STATUS_META = {
    PRESENT:    { label: "Present",  pill: "bg-green-100 text-green-700",   dot: "bg-green-500" },
    WFH:        { label: "WFH",      pill: "bg-purple-100 text-purple-700", dot: "bg-purple-500" },
    ABSENT:     { label: "Absent",   pill: "bg-rose-100 text-rose-700",     dot: "bg-rose-500" },
    LEAVE:      { label: "Leave",    pill: "bg-blue-100 text-blue-700",     dot: "bg-blue-500" },
    HALF_DAY:   { label: "Half Day", pill: "bg-amber-100 text-amber-700",   dot: "bg-amber-500" },
    COMP_OFF:   { label: "Comp Off", pill: "bg-indigo-100 text-indigo-700", dot: "bg-indigo-500" },
    NOT_MARKED: { label: "Not marked", pill: "bg-gray-100 text-gray-500",   dot: "bg-gray-300" },
};

// Local YYYY-MM-DD (avoids the UTC shift toISOString() would introduce).
const toDateStr = (d) => {
    const x = new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

const fmtTime = (t) => t ? new Date(t).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—";

// Department values are stored inconsistently (e.g. "FOREX" vs "Forex",
// "ACCOMMODATION_TICKETS"). Normalize to a single key so the same team isn't
// listed twice, and prettify a label for display.
const normTeam = (d) => (d || "").trim().toUpperCase().replace(/_/g, " ").replace(/\s+/g, " ");
const prettyTeam = (key) => key.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const initials = (name = "") =>
    name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

const SUMMARY_CARDS = [
    { key: "PRESENT",    label: "Present",  icon: CheckCircle, tint: "bg-green-50 text-green-600" },
    { key: "WFH",        label: "WFH",      icon: Home,        tint: "bg-purple-50 text-purple-600" },
    { key: "ABSENT",     label: "Absent",   icon: UserX,       tint: "bg-rose-50 text-rose-600" },
    { key: "LEAVE",      label: "Leave",    icon: Plane,       tint: "bg-blue-50 text-blue-600" },
    { key: "HALF_DAY",   label: "Half Day", icon: Clock,       tint: "bg-amber-50 text-amber-600" },
    { key: "NOT_MARKED", label: "Not marked", icon: AlertCircle, tint: "bg-gray-100 text-gray-500" },
];

export default function TeamAttendance() {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const [date, setDate] = useState(() => toDateStr(new Date()));
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [teamFilter, setTeamFilter] = useState("ALL");
    const [savingUserId, setSavingUserId] = useState(null);

    const isToday = date === toDateStr(new Date());

    const { data: team = [] } = useQuery({
        queryKey: ["team", "attendance-roster"],
        queryFn: () => api.get("/team").then(r => {
            const list = r.data?.members || r.data || [];
            return (Array.isArray(list) ? list : []).filter(u => u.isActive !== false);
        }),
        staleTime: 300_000,
        enabled: isManager(user?.role),
    });

    const { data: records = [], isLoading } = useQuery({
        queryKey: ["attendance-all", date],
        queryFn: () => api.get(`/attendance/all?date=${date}`).then(r => r.data || []),
        enabled: isManager(user?.role),
    });

    const updateStatus = useMutation({
        mutationFn: ({ userId, status }) =>
            api.post("/attendance/admin/update-status", { userId, date, status }),
        onMutate: ({ userId }) => setSavingUserId(userId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["attendance-all", date] });
            toast.success("Attendance updated");
        },
        onError: (e) => toast.error(e.response?.data?.message || "Failed to update attendance"),
        onSettled: () => setSavingUserId(null),
    });

    // Merge the roster with the day's records so people who never checked in still appear.
    const rows = useMemo(() => {
        const byUser = new Map(records.map(r => [r.userId, r]));
        // Prefer the roster as the source of truth; fall back to record.user for anyone
        // not in the roster (e.g. deactivated mid-day) so nothing silently disappears.
        const seen = new Set();
        const list = team.map(member => {
            seen.add(member.id);
            const rec = byUser.get(member.id);
            return {
                userId: member.id,
                name: member.name,
                department: member.department,
                status: rec?.status || "NOT_MARKED",
                checkIn: rec?.checkIn,
                checkOut: rec?.checkOut,
            };
        });
        records.forEach(rec => {
            if (!seen.has(rec.userId) && rec.user) {
                list.push({
                    userId: rec.userId,
                    name: rec.user.name,
                    department: rec.user.department,
                    status: rec.status || "NOT_MARKED",
                    checkIn: rec.checkIn,
                    checkOut: rec.checkOut,
                });
            }
        });
        return list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }, [team, records]);

    const counts = useMemo(() => {
        const c = { PRESENT: 0, WFH: 0, ABSENT: 0, LEAVE: 0, HALF_DAY: 0, COMP_OFF: 0, NOT_MARKED: 0 };
        rows.forEach(r => { c[r.status] = (c[r.status] ?? 0) + 1; });
        return c;
    }, [rows]);

    // Distinct teams (departments), deduped case-insensitively → [key, label].
    const teams = useMemo(() => {
        const map = new Map();
        rows.forEach(r => {
            const key = normTeam(r.department);
            if (key && !map.has(key)) map.set(key, prettyTeam(key));
        });
        return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
    }, [rows]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return rows.filter(r =>
            (statusFilter === "ALL" || r.status === statusFilter) &&
            (teamFilter === "ALL" || normTeam(r.department) === teamFilter) &&
            (!q || r.name?.toLowerCase().includes(q))
        );
    }, [rows, search, statusFilter, teamFilter]);

    const shiftDay = (delta) => {
        const d = new Date(date);
        d.setDate(d.getDate() + delta);
        setDate(toDateStr(d));
    };

    if (!isManager(user?.role)) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
                <AlertCircle className="h-8 w-8 text-rose-400" />
                <p className="text-gray-600 font-medium">This page is for managers and directors only.</p>
                <Link to="/attendance" className="text-sm text-indigo-600 hover:underline">View my attendance →</Link>
            </div>
        );
    }

    const prettyDate = new Date(date).toLocaleDateString("en-IN", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
    });

    return (
        <div className="space-y-6 max-w-[1400px] mx-auto">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200/60 pb-5">
                <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-xl bg-indigo-50 flex items-center justify-center">
                        <Users className="h-6 w-6 text-indigo-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-indigo-950">Team Attendance</h1>
                        <p className="text-sm text-gray-500 mt-0.5">{prettyDate}{isToday && " · Today"}</p>
                    </div>
                </div>

                {/* Date navigator */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => shiftDay(-1)}
                        title="Previous day"
                        className="h-9 w-9 flex items-center justify-center rounded-xl border border-gray-200/70 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <div className="relative">
                        <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                        <input
                            type="date"
                            value={date}
                            max={toDateStr(new Date())}
                            onChange={e => e.target.value && setDate(e.target.value)}
                            className="h-9 pl-8 pr-3 text-sm font-semibold rounded-xl border border-gray-200/70 bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none"
                        />
                    </div>
                    <button
                        onClick={() => shiftDay(1)}
                        disabled={isToday}
                        title="Next day"
                        className="h-9 w-9 flex items-center justify-center rounded-xl border border-gray-200/70 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                    {!isToday && (
                        <button
                            onClick={() => setDate(toDateStr(new Date()))}
                            className="h-9 px-3 text-sm font-semibold rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                        >
                            Today
                        </button>
                    )}
                </div>
            </header>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {SUMMARY_CARDS.map(({ key, label, icon: Icon, tint }) => {
                    const active = statusFilter === key;
                    return (
                        <button
                            key={key}
                            onClick={() => setStatusFilter(active ? "ALL" : key)}
                            className={`flex items-center gap-3 rounded-2xl border bg-white px-4 py-3 shadow-sm text-left transition-all ${
                                active ? "border-indigo-300 ring-1 ring-indigo-200" : "border-gray-200/70 hover:border-gray-300"
                            }`}
                        >
                            <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${tint}`}>
                                <Icon className="h-4.5 w-4.5" />
                            </div>
                            <div className="leading-none">
                                <p className="text-xl font-black text-gray-900 leading-none">{counts[key] ?? 0}</p>
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mt-1">{label}</p>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                    {/* Name search */}
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search by name…"
                            className="w-full h-10 pl-9 pr-3 text-sm rounded-xl border border-gray-200/70 bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none placeholder:text-gray-400"
                        />
                    </div>
                    {/* Team (department) filter */}
                    <div className="relative">
                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-500 pointer-events-none" />
                        <select
                            value={teamFilter}
                            onChange={e => setTeamFilter(e.target.value)}
                            className={`h-10 pl-9 pr-8 text-sm font-semibold rounded-xl border bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none cursor-pointer appearance-none ${
                                teamFilter === "ALL" ? "border-gray-200/70 text-gray-600" : "border-indigo-200 text-indigo-700"
                            }`}
                        >
                            <option value="ALL">All Teams</option>
                            {teams.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                    </div>
                </div>
                {(statusFilter !== "ALL" || teamFilter !== "ALL") && (
                    <button
                        onClick={() => { setStatusFilter("ALL"); setTeamFilter("ALL"); }}
                        className="text-xs font-semibold text-indigo-600 hover:underline"
                    >
                        Clear filters
                    </button>
                )}
            </div>

            {/* Table */}
            <div className="bg-white border border-gray-200/70 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/60 text-left">
                                <th className="px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Employee</th>
                                <th className="px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Department</th>
                                <th className="px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Check In</th>
                                <th className="px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Check Out</th>
                                <th className="px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                                <th className="px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-right">Set status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {isLoading ? (
                                <tr><td colSpan={6} className="py-16 text-center"><Loader2 className="h-5 w-5 animate-spin text-indigo-400 mx-auto" /></td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={6} className="py-16 text-center text-sm text-gray-400">No employees match this view.</td></tr>
                            ) : (
                                filtered.map(row => {
                                    const meta = STATUS_META[row.status] || STATUS_META.NOT_MARKED;
                                    return (
                                        <tr key={row.userId} className="hover:bg-gray-50/60 transition-colors">
                                            <td className="px-5 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700 shrink-0">
                                                        {initials(row.name)}
                                                    </div>
                                                    <span className="font-semibold text-gray-900">{row.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3 text-gray-500">{row.department || "—"}</td>
                                            <td className="px-5 py-3 text-gray-600 tabular-nums">{fmtTime(row.checkIn)}</td>
                                            <td className="px-5 py-3 text-gray-600 tabular-nums">{fmtTime(row.checkOut)}</td>
                                            <td className="px-5 py-3">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full ${meta.pill}`}>
                                                    <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                                                    {meta.label}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 text-right">
                                                <div className="inline-flex items-center gap-2 justify-end">
                                                    {savingUserId === row.userId && <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />}
                                                    <select
                                                        value={row.status === "NOT_MARKED" ? "" : row.status}
                                                        disabled={savingUserId === row.userId}
                                                        onChange={e => e.target.value && updateStatus.mutate({ userId: row.userId, status: e.target.value })}
                                                        className="h-8 px-2 text-xs font-semibold rounded-lg border border-gray-200 bg-white text-gray-700 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none cursor-pointer disabled:opacity-50"
                                                    >
                                                        <option value="" disabled>Set…</option>
                                                        {STATUSES.map(s => (
                                                            <option key={s} value={s}>{STATUS_META[s].label}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/40 text-xs text-gray-500">
                    <span>Showing <strong className="text-gray-700">{filtered.length}</strong> of {rows.length} employees</span>
                    <Link to="/attendance" className="inline-flex items-center gap-1 text-indigo-600 hover:underline font-semibold">
                        <ArrowLeft className="h-3 w-3" /> My attendance
                    </Link>
                </div>
            </div>
        </div>
    );
}
