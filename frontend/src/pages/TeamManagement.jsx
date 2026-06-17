import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Users, UserCheck, ClipboardList, Clock, ChevronRight, X,
    Shield, Phone, Mail, Briefcase, Building2, Activity,
    ToggleLeft, ToggleRight, Search, ChevronDown,
} from "lucide-react";
import { toast } from
    "sonner";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

// ── Role config ───────────────────────────────────────────────────────────────

const ROLE_CONFIG = {
    SUPER_ADMIN: { label: "Director",   bg: "bg-red-100",    text: "text-red-700"    },
    ADMIN:     { label: "Manager",    bg: "bg-violet-100", text: "text-violet-700" },
    EMPLOYEE:    { label: "Consultant", bg: "bg-blue-100",   text: "text-blue-700"   },
};

const RoleBadge = ({ role }) => {
    const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.EMPLOYEE;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
            {cfg.label}
        </span>
    );
};

const StatusDot = ({ isActive }) => (
    <span className={`inline-block h-2 w-2 rounded-full ${isActive ? "bg-green-500" : "bg-gray-300"}`} />
);

// ── Stat Card ─────────────────────────────────────────────────────────────────

const StatCard = ({ icon: Icon, label, value, color }) => (
    <div className="bg-white rounded-xl border border-gray-100 p-5 flex items-center gap-4 shadow-sm">
        <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${color}`}>
            <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
            <p className="text-2xl font-bold text-gray-900">{value ?? "—"}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
        </div>
    </div>
);

// ── Employee Profile Drawer ───────────────────────────────────────────────────

const EmployeeDrawer = ({ employeeId, onClose, managers, currentUserId, currentUserRole }) => {
    const queryClient = useQueryClient();

    const { data: profile, isLoading } = useQuery({
        queryKey: ["org-employee", employeeId],
        queryFn: () => api.get(`/organization/team/${employeeId}`).then(r => r.data),
        enabled: !!employeeId,
    });

    const setManagerMutation = useMutation({
        mutationFn: ({ id, managerId }) => api.patch(`/organization/team/${id}/manager`, { managerId }),
        onSuccess: () => {
            toast.success("Manager updated");
            queryClient.invalidateQueries({ queryKey: ["org-team"] });
            queryClient.invalidateQueries({ queryKey: ["org-employee", employeeId] });
        },
        onError: (err) => toast.error(err.response?.data?.message || "Failed to update manager"),
    });

    if (!employeeId) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/30" onClick={onClose} />
            <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                    <h2 className="text-base font-semibold text-gray-900">Employee Profile</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
                        <X className="h-4 w-4 text-gray-500" />
                    </button>
                </div>

                {isLoading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : profile ? (
                    <div className="flex-1 p-5 space-y-6">
                        {/* Identity */}
                        <div className="flex items-start gap-4">
                            <div className="h-14 w-14 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xl flex-shrink-0">
                                {profile.name?.[0]?.toUpperCase()}
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">{profile.name}</h3>
                                <p className="text-sm text-gray-500">{profile.jobTitle || "—"}</p>
                                <div className="mt-1.5 flex items-center gap-2">
                                    <RoleBadge role={profile.role} />
                                    <span className={`text-xs font-medium ${profile.isActive ? "text-green-600" : "text-gray-400"}`}>
                                        {profile.isActive ? "Active" : "Inactive"}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Contact */}
                        <div className="space-y-2">
                            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Contact</h4>
                            <div className="flex items-center gap-2 text-sm text-gray-700">
                                <Mail className="h-4 w-4 text-gray-400" />
                                {profile.email}
                            </div>
                            {profile.phone && (
                                <div className="flex items-center gap-2 text-sm text-gray-700">
                                    <Phone className="h-4 w-4 text-gray-400" />
                                    {profile.phone}
                                </div>
                            )}
                            {profile.department && (
                                <div className="flex items-center gap-2 text-sm text-gray-700">
                                    <Building2 className="h-4 w-4 text-gray-400" />
                                    {profile.department}
                                </div>
                            )}
                        </div>

                        {/* Stats */}
                        <div className="space-y-2">
                            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Performance</h4>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { label: "Assigned Leads", value: profile.assignedLeads ?? 0, icon: Users },
                                    { label: "Pending Leads", value: profile.pendingLeads ?? 0, icon: Clock },
                                    { label: "Tasks", value: profile._count?.tasks ?? 0, icon: ClipboardList },
                                ].map(({ label, value, icon: Icon }) => (
                                    <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
                                        <Icon className="h-4 w-4 text-gray-400 mx-auto mb-1" />
                                        <p className="text-lg font-bold text-gray-900">{value}</p>
                                        <p className="text-xs text-gray-500 leading-tight">{label}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Manager */}
                        <div className="space-y-2">
                            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Manager</h4>
                            {currentUserRole === "SUPER_ADMIN" ? (
                                <div className="relative">
                                    <select
                                        value={profile.managerId || ""}
                                        onChange={(e) => setManagerMutation.mutate({ id: profile.id, managerId: e.target.value || null })}
                                        disabled={setManagerMutation.isPending}
                                        className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="">No Manager</option>
                                        {managers?.filter(m => m.id !== profile.id).map(m => (
                                            <option key={m.id} value={m.id}>{m.name} ({ROLE_CONFIG[m.role]?.label})</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                                </div>
                            ) : (
                                <p className="text-sm text-gray-700">
                                    {profile.manager ? profile.manager.name : <span className="text-gray-400">Unassigned</span>}
                                </p>
                            )}
                        </div>

                        {/* Direct reports */}
                        {profile.employees?.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                                    Direct Reports ({profile.employees.length})
                                </h4>
                                <div className="space-y-1.5">
                                    {profile.employees.map(emp => (
                                        <div key={emp.id} className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">
                                            <StatusDot isActive={emp.isActive} />
                                            {emp.name}
                                            <span className="ml-auto"><RoleBadge role={emp.role} /></span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                        Employee not found
                    </div>
                )}
            </div>
        </div>
    );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

const TeamManagement = () => {
    const { user: currentUser } = useAuth();
    const queryClient = useQueryClient();
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("ALL");
    const [selectedId, setSelectedId] = useState(null);

    const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";
    const isAuthorized = ["SUPER_ADMIN", "ADMIN"].includes(currentUser?.role);

    const { data: stats } = useQuery({
        queryKey: ["org-stats"],
        queryFn: () => api.get("/organization/stats").then(r => r.data),
        enabled: isAuthorized,
    });

    const { data: members = [], isLoading } = useQuery({
        queryKey: ["org-team"],
        queryFn: () => api.get("/organization/team").then(r => r.data),
        enabled: isAuthorized,
    });

    const { data: managers = [] } = useQuery({
        queryKey: ["org-managers"],
        queryFn: () => api.get("/organization/managers").then(r => r.data),
        enabled: isSuperAdmin,
    });

    const toggleMutation = useMutation({
        mutationFn: (id) => api.patch(`/team/${id}/toggle`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["org-team"] }),
        onError: (err) => toast.error(err.response?.data?.message || "Failed"),
    });

    if (!isAuthorized) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="h-14 w-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                    <Shield className="h-7 w-7 text-gray-400" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Access Denied</h2>
                <p className="text-sm text-gray-500 mt-1">Only Managers and Directors can view this page.</p>
            </div>
        );
    }

    const filtered = members.filter((m) => {
        const matchRole = roleFilter === "ALL" || m.role === roleFilter;
        const matchSearch =
            !search ||
            m.name.toLowerCase().includes(search.toLowerCase()) ||
            m.email.toLowerCase().includes(search.toLowerCase()) ||
            (m.department || "").toLowerCase().includes(search.toLowerCase());
        return matchRole && matchSearch;
    });

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Team Management</h1>
                <p className="text-sm text-gray-500 mt-1">
                    {isSuperAdmin ? "Full organization hierarchy" : "Your team members"}
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={Users} label="Total Employees" value={stats?.totalEmployees} color="bg-indigo-500" />
                <StatCard icon={UserCheck} label="Active Employees" value={stats?.activeEmployees} color="bg-green-500" />
                <StatCard icon={ClipboardList} label="Assigned Leads" value={stats?.assignedLeads} color="bg-indigo-600" />
                <StatCard icon={Clock} label="Pending Leads" value={stats?.pendingLeads} color="bg-red-400" />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by name, email, department…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
                <div className="relative">
                    <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="ALL">All Roles</option>
                        {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
                            <option key={key} value={key}>{cfg.label}</option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="px-4 py-3 text-left font-semibold text-gray-500">Employee</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-500">Role</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-500">Status</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-500">Leads</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-500">Tasks</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-500">Manager</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-500">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {isLoading ? (
                            Array.from({ length: 6 }).map((_, i) => (
                                <tr key={i}>
                                    {Array.from({ length: 7 }).map((_, j) => (
                                        <td key={j} className="px-4 py-3">
                                            <div className="h-4 bg-gray-100 rounded animate-pulse w-24" />
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">
                                    No team members found.
                                </td>
                            </tr>
                        ) : (
                            filtered.map((member) => (
                                <tr
                                    key={member.id}
                                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                                    onClick={() => setSelectedId(member.id)}
                                >
                                    {/* Employee */}
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-sm flex-shrink-0">
                                                {member.name?.[0]?.toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900">{member.name}</p>
                                                <p className="text-xs text-gray-400">{member.email}</p>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Role */}
                                    <td className="px-4 py-3">
                                        <RoleBadge role={member.role} />
                                    </td>

                                    {/* Status */}
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1.5">
                                            <StatusDot isActive={member.isActive} />
                                            <span className={`text-xs font-medium ${member.isActive ? "text-green-600" : "text-gray-400"}`}>
                                                {member.isActive ? "Active" : "Inactive"}
                                            </span>
                                        </div>
                                    </td>

                                    {/* Leads */}
                                    <td className="px-4 py-3 text-gray-700 font-medium">
                                        {member._count?.leads ?? 0}
                                    </td>

                                    {/* Tasks */}
                                    <td className="px-4 py-3 text-gray-700 font-medium">
                                        {member._count?.tasks ?? 0}
                                    </td>

                                    {/* Manager */}
                                    <td className="px-4 py-3 text-gray-500 text-xs">
                                        {member.manager?.name || <span className="text-gray-300">—</span>}
                                    </td>

                                    {/* Actions */}
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                title={member.isActive ? "Deactivate" : "Activate"}
                                                onClick={() => toggleMutation.mutate(member.id)}
                                                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                                            >
                                                {member.isActive
                                                    ? <ToggleRight className="h-4 w-4 text-green-500" />
                                                    : <ToggleLeft className="h-4 w-4 text-gray-400" />
                                                }
                                            </button>
                                            <button
                                                onClick={() => setSelectedId(member.id)}
                                                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-indigo-600"
                                            >
                                                <ChevronRight className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Employee Drawer */}
            {selectedId && (
                <EmployeeDrawer
                    employeeId={selectedId}
                    onClose={() => setSelectedId(null)}
                    managers={managers}
                    currentUserId={currentUser?.id}
                    currentUserRole={currentUser?.role}
                />
            )}
        </div>
    );
};

export default TeamManagement;
