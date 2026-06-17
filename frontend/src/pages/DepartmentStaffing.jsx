import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Users, Loader2, ShieldCheck } from "lucide-react";
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

    // Filter users list based on selected role tab
    const filteredUsers = useMemo(() => {
        if (roleTab === "all") return users;
        return users.filter((u) => u.role === roleTab);
    }, [users, roleTab]);

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
            <div className="flex items-center gap-2 mb-1">
                <Users className="h-5 w-5 text-indigo-600" />
                <h1 className="text-xl font-bold text-gray-900">Department Staffing</h1>
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
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredUsers.map((u) => (
                                <tr key={u.id} className="hover:bg-gray-50/40">
                                    <td className="px-4 py-2.5 sticky left-0 bg-white">
                                        <div className="font-medium text-gray-900">{u.name}</div>
                                        <div className="text-[11px] text-gray-400">{u.role === "SUPER_ADMIN" ? "Director" : u.role === "ADMIN" ? "Manager" : "Consultant"}</div>
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
                                                    <input
                                                        type="checkbox"
                                                        checked={Boolean(isMember)}
                                                        onChange={() => toggleMut.mutate({ userId: u.id, department: d, isMember })}
                                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-200 cursor-pointer"
                                                    />
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
