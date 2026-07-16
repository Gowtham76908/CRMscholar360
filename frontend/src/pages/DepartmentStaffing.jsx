import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Users, Loader2, ShieldCheck, Search } from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { departmentLabel, DEPARTMENT_ORDER } from "../lib/departments";

/**
 * Department Staffing (Director only) — a user × department membership matrix.
 * Toggling a cell adds/removes a UserDepartment row, which controls who a manager
 * can assign within a department and what a manager/consultant can see.
 */
export default function DepartmentStaffing() {
    const { user } = useAuth();
    const qc = useQueryClient();
    const [roleTab, setRoleTab] = useState("all"); // "all", "SUPER_ADMIN", "ADMIN", "EMPLOYEE"
    const [search, setSearch] = useState("");

    // Use /team endpoint to fetch the updated user and member list
    const { data: users = [], isLoading: usersLoading } = useQuery({
        queryKey: ["team"],
        queryFn: () => api.get("/team").then((r) => r.data || []),
    });

    // One membership query per department; combine into { dept: Set(userId) }.
    const memberQueries = useQuery({
        queryKey: ["all-department-members"],
        queryFn: async () => {
            const entries = await Promise.all(
                DEPARTMENT_ORDER.map(async (d) => {
                    const r = await api.get("/lead-departments/members", { params: { department: d } });
                    return [d, r.data];
                })
            );
            return Object.fromEntries(entries);
        },
    });

    const memberSets = useMemo(() => {
        const map = {};
        for (const d of DEPARTMENT_ORDER) {
            map[d] = new Set((memberQueries.data?.[d] || []).map((u) => u.id));
        }
        return map;
    }, [memberQueries.data]);

    const toggleMut = useMutation({
        mutationFn: ({ userId, department, isMember }) =>
            isMember
                ? api.delete("/lead-departments/members", { data: { userId, department } })
                : api.post("/lead-departments/members", { userId, department }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["all-department-members"] });
            qc.invalidateQueries({ queryKey: ["department-members"] });
        },
        onError: (e) => toast.error(e.response?.data?.error?.message || "Could not update membership"),
    });

    const togglePermMut = useMutation({
        mutationFn: ({ userId, key, isAllowed }) => {
            const u = users.find(usr => usr.id === userId);
            const currentPrefs = u?.preferences || {};
            const currentPerms = currentPrefs.permissions || {};
            const nextPrefs = {
                ...currentPrefs,
                permissions: {
                    ...currentPerms,
                    [key]: !isAllowed
                }
            };
            return api.patch(`/team/${userId}`, { preferences: nextPrefs });
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["team"] });
            toast.success("Permissions updated");
        },
        onError: (e) => toast.error(e.response?.data?.error?.message || "Could not update permission"),
    });

    // Filter users list based on selected role tab and name search
    const filteredUsers = useMemo(() => {
        const q = search.trim().toLowerCase();
        return users.filter((u) => {
            const matchRole = roleTab === "all" || u.role === roleTab;
            const matchSearch = !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
            return matchRole && matchSearch;
        });
    }, [users, roleTab, search]);

    if (user?.role !== "SUPER_ADMIN") {
        return (
            <div className="max-w-3xl mx-auto px-4 py-12 text-center text-sm text-gray-500">
                <ShieldCheck className="h-6 w-6 text-gray-300 mx-auto mb-2" />
                Only a Director can manage department staffing.
            </div>
        );
    }

    const loading = usersLoading || memberQueries.isLoading;

    return (
        <div className="max-w-6xl mx-auto px-4 py-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-1">
                <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-indigo-600" />
                    <h1 className="text-xl font-bold text-gray-900">Department Staffing</h1>
                </div>
                {/* Search */}
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by name or email…"
                        className="w-full h-9 pl-9 pr-3 text-xs rounded-xl border border-gray-200 bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none placeholder:text-gray-400"
                    />
                </div>
            </div>
            <p className="text-sm text-gray-500 mb-5">Assign users to departments. Membership controls visibility and who can be assigned services.</p>

            {/* Role Tabs */}
            <div className="flex border-b border-gray-200 mb-5">
                <button
                    onClick={() => setRoleTab("all")}
                    className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer -mb-[2px] ${
                        roleTab === "all"
                            ? "border-indigo-600 text-indigo-600"
                            : "border-transparent text-gray-400 hover:text-gray-600"
                    }`}
                >
                    All Staff ({users.length})
                </button>
                <button
                    onClick={() => setRoleTab("SUPER_ADMIN")}
                    className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer -mb-[2px] ${
                        roleTab === "SUPER_ADMIN"
                            ? "border-indigo-600 text-indigo-600"
                            : "border-transparent text-gray-400 hover:text-gray-600"
                    }`}
                >
                    Directors ({users.filter(u => u.role === "SUPER_ADMIN").length})
                </button>
                <button
                    onClick={() => setRoleTab("ADMIN")}
                    className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer -mb-[2px] ${
                        roleTab === "ADMIN"
                            ? "border-indigo-600 text-indigo-600"
                            : "border-transparent text-gray-400 hover:text-gray-600"
                    }`}
                >
                    Managers ({users.filter(u => u.role === "ADMIN").length})
                </button>
                <button
                    onClick={() => setRoleTab("TEAM_LEADER")}
                    className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer -mb-[2px] ${
                        roleTab === "TEAM_LEADER"
                            ? "border-indigo-600 text-indigo-600"
                            : "border-transparent text-gray-400 hover:text-gray-600"
                    }`}
                >
                    Team Leaders ({users.filter(u => u.role === "TEAM_LEADER").length})
                </button>
                <button
                    onClick={() => setRoleTab("EMPLOYEE")}
                    className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer -mb-[2px] ${
                        roleTab === "EMPLOYEE"
                            ? "border-indigo-600 text-indigo-600"
                            : "border-transparent text-gray-400 hover:text-gray-600"
                    }`}
                >
                    Consultants ({users.filter(u => u.role === "EMPLOYEE").length})
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
            ) : filteredUsers.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-500">
                    No users found under this category.
                </div>
            ) : (
                <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/60">
                                <th className="text-left font-semibold text-gray-500 text-xs uppercase tracking-wide px-4 py-3 sticky left-0 bg-gray-50/60">User</th>
                                {DEPARTMENT_ORDER.map((d) => (
                                    <th key={d} className="text-center font-semibold text-gray-500 text-[11px] px-3 py-3 whitespace-nowrap">
                                        {departmentLabel(d)}
                                    </th>
                                ))}
                                <th className="text-center font-bold text-violet-650 text-[11px] px-3 py-3 whitespace-nowrap bg-violet-50/20">
                                    Commission Invoicing
                                </th>
                                <th className="text-center font-bold text-violet-650 text-[11px] px-3 py-3 whitespace-nowrap bg-violet-50/20">
                                    Invoice Access
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredUsers.map((u) => {
                                const isAlwaysAllowed = u.role === "SUPER_ADMIN";
                                const hasCI = isAlwaysAllowed || u.preferences?.permissions?.commissionInvoicing !== false;
                                const hasInv = isAlwaysAllowed || u.preferences?.permissions?.invoice !== false;

                                const pendingCI = togglePermMut.isPending && togglePermMut.variables?.userId === u.id && togglePermMut.variables?.key === "commissionInvoicing";
                                const pendingInv = togglePermMut.isPending && togglePermMut.variables?.userId === u.id && togglePermMut.variables?.key === "invoice";

                                return (
                                    <tr key={u.id} className="hover:bg-gray-50/40">
                                        <td className="px-4 py-2.5 sticky left-0 bg-white">
                                            <div className="font-medium text-gray-900">{u.name}</div>
                                            <div className="text-[11px] text-gray-400">
                                                {u.role === "SUPER_ADMIN" ? "Director" : u.role === "ADMIN" ? "Manager" : u.role === "TEAM_LEADER" ? "Team Leader" : "Consultant"}
                                            </div>
                                        </td>
                                        {DEPARTMENT_ORDER.map((d) => {
                                            const isMember = memberSets[d]?.has(u.id);
                                            const pending =
                                                toggleMut.isPending &&
                                                toggleMut.variables?.userId === u.id &&
                                                toggleMut.variables?.department === d;
                                            return (
                                                <td key={d} className="text-center px-3 py-2.5">
                                                    {pending ? (
                                                        <Loader2 className="h-4 w-4 animate-spin text-gray-400 mx-auto" />
                                                    ) : (
                                                        <button
                                                            onClick={() => toggleMut.mutate({ userId: u.id, department: d, isMember })}
                                                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                                                                isMember ? "bg-indigo-600" : "bg-gray-200"
                                                            }`}
                                                            role="switch"
                                                            aria-checked={isMember}
                                                        >
                                                            <span
                                                                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                                                                    isMember ? "translate-x-4" : "translate-x-0.5"
                                                                }`}
                                                            />
                                                        </button>
                                                    )}
                                                </td>
                                            );
                                        })}

                                        {/* Commission Invoicing toggle */}
                                        <td className="text-center px-3 py-2.5 bg-violet-50/5">
                                            {pendingCI ? (
                                                <Loader2 className="h-4 w-4 animate-spin text-gray-400 mx-auto" />
                                            ) : (
                                                <button
                                                    disabled={isAlwaysAllowed}
                                                    onClick={() => togglePermMut.mutate({ userId: u.id, key: "commissionInvoicing", isAllowed: hasCI })}
                                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                                                        hasCI ? "bg-indigo-600" : "bg-gray-200"
                                                    } ${isAlwaysAllowed ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                                                    role="switch"
                                                    aria-checked={hasCI}
                                                >
                                                    <span
                                                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                                                            hasCI ? "translate-x-4" : "translate-x-0.5"
                                                        }`}
                                                    />
                                                </button>
                                            )}
                                        </td>

                                        {/* Invoice toggle */}
                                        <td className="text-center px-3 py-2.5 bg-violet-50/5">
                                            {pendingInv ? (
                                                <Loader2 className="h-4 w-4 animate-spin text-gray-400 mx-auto" />
                                            ) : (
                                                <button
                                                    disabled={isAlwaysAllowed}
                                                    onClick={() => togglePermMut.mutate({ userId: u.id, key: "invoice", isAllowed: hasInv })}
                                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                                                        hasInv ? "bg-indigo-600" : "bg-gray-200"
                                                    } ${isAlwaysAllowed ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                                                    role="switch"
                                                    aria-checked={hasInv}
                                                >
                                                    <span
                                                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                                                            hasInv ? "translate-x-4" : "translate-x-0.5"
                                                        }`}
                                                    />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
