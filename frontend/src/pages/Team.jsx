import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/axios";
import { Loader2, Trash2, Power, UserPlus, Shield, ToggleLeft, ToggleRight, Edit, Mail, Building } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import Dialog from "../components/ui/Dialog";
import { Modal } from "../components/Modal";
import AddUserForm from "../components/AddUserForm";
import EditUserForm from "../components/EditUserForm";
import { cn } from "../lib/utils";

const ROLE_STYLES = {
    SUPER_ADMIN: "bg-indigo-100 text-indigo-700",
    ADMIN:       "bg-violet-100 text-violet-700",
    EMPLOYEE:    "bg-gray-100 text-gray-600",
};

const Team = () => {
    const { user: currentUser } = useAuth();
    const queryClient = useQueryClient();
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(currentUser?.role);

    const { data: team, isLoading, error: teamError } = useQuery({
        queryKey: ["team"],
        queryFn: () => api.get("/team").then(r => r.data),
        enabled: isAdmin,
    });

    const toggleAccessMutation = useMutation({
        mutationFn: (userId) => api.patch(`/team/${userId}/toggle`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team"] }),
        onError: (err) => toast.error(err.response?.data?.message || "Failed to toggle access"),
    });

    const roleMutation = useMutation({
        mutationFn: ({ userId, role }) => api.patch(`/team/${userId}`, { role }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team"] }),
        onError: (err) => toast.error(err.response?.data?.message || "Failed to update role"),
    });

    const deleteMutation = useMutation({
        mutationFn: (userId) => api.delete(`/team/${userId}`),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["team"] }); setConfirmDeleteId(null); },
        onError: (err) => toast.error(err.response?.data?.message || "Failed to delete user"),
    });

    if (!isAdmin) return (
        <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                <Shield className="h-7 w-7 text-gray-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Access Denied</h2>
            <p className="text-sm text-gray-500 mt-1">Only Admins can manage the team.</p>
        </div>
    );

    if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-indigo-500" /></div>;
    if (teamError) return <div className="text-center py-20 text-red-500">{teamError.response?.data?.message || "Failed to load team."}</div>;

    const active = team?.filter(m => m.isActive).length ?? 0;
    const admins = team?.filter(m => ["ADMIN","SUPER_ADMIN"].includes(m.role)).length ?? 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Team</h1>
                    <p className="text-sm text-gray-500">{team?.length ?? 0} members · {active} active · {admins} admins</p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors"
                >
                    <UserPlus className="h-4 w-4" />
                    Add Member
                </button>
            </div>

            {/* Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {team?.map((member) => (
                    <div
                        key={member.id}
                        className={cn(
                            "bg-white rounded-2xl border shadow-sm flex flex-col transition-all hover:shadow-md",
                            member.isActive ? "border-gray-200" : "border-gray-100 opacity-60"
                        )}
                    >
                        {/* Card top */}
                        <div className="p-4 flex items-center gap-3">
                            {/* Avatar */}
                            <div className="relative flex-shrink-0">
                                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white font-bold text-base">
                                    {member.name[0].toUpperCase()}
                                </div>
                                <span className={cn(
                                    "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white",
                                    member.isActive ? "bg-emerald-400" : "bg-gray-300"
                                )} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="font-semibold text-gray-900 truncate text-sm">{member.name}</p>
                                <div className="flex items-center gap-1 mt-0.5">
                                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", ROLE_STYLES[member.role] ?? ROLE_STYLES.EMPLOYEE)}>
                                        {member.role.replace("_", " ")}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Details */}
                        <div className="px-4 pb-3 space-y-1.5 border-t border-gray-100 pt-3">
                            <div className="flex items-center gap-2 text-xs text-gray-500 truncate">
                                <Mail className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />
                                <span className="truncate">{member.email}</span>
                            </div>
                            {member.department && (
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                    <Building className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />
                                    <span>{member.department}</span>
                                </div>
                            )}
                        </div>

                        {/* Footer actions */}
                        {member.role !== "SUPER_ADMIN" && (
                            <div className="px-4 pb-4 pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                                {/* Admin toggle — super admin only */}
                                {currentUser.role === "SUPER_ADMIN" ? (
                                    <button
                                        onClick={() => roleMutation.mutate({ userId: member.id, role: member.role === "ADMIN" ? "EMPLOYEE" : "ADMIN" })}
                                        title="Toggle Admin"
                                        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 transition-colors"
                                    >
                                        {member.role === "ADMIN"
                                            ? <ToggleRight className="h-5 w-5 text-indigo-500" />
                                            : <ToggleLeft className="h-5 w-5 text-gray-300" />
                                        }
                                        <span>{member.role === "ADMIN" ? "Admin" : "Employee"}</span>
                                    </button>
                                ) : (
                                    <span className="text-xs text-gray-400">{member.role === "ADMIN" ? "Has admin access" : "Standard access"}</span>
                                )}

                                <div className="flex items-center gap-1.5">
                                    {currentUser.role === "SUPER_ADMIN" && (
                                        <button
                                            onClick={() => setEditingUser(member)}
                                            className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                            title="Edit"
                                        >
                                            <Edit className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => toggleAccessMutation.mutate(member.id)}
                                        className={cn(
                                            "p-1.5 rounded-lg transition-colors",
                                            member.isActive
                                                ? "text-emerald-500 hover:text-gray-400 hover:bg-gray-50"
                                                : "text-gray-300 hover:text-emerald-500 hover:bg-emerald-50"
                                        )}
                                        title={member.isActive ? "Deactivate" : "Activate"}
                                    >
                                        <Power className="h-3.5 w-3.5" />
                                    </button>
                                    {currentUser.role === "SUPER_ADMIN" && (
                                        <button
                                            onClick={() => setConfirmDeleteId(member.id)}
                                            className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Add Team Member">
                <AddUserForm onClose={() => setIsAddModalOpen(false)} />
            </Modal>

            <Modal isOpen={!!editingUser} onClose={() => setEditingUser(null)} title="Edit Team Member">
                {editingUser && <EditUserForm user={editingUser} onClose={() => setEditingUser(null)} />}
            </Modal>

            <Dialog
                open={!!confirmDeleteId}
                variant="danger"
                title="Delete team member?"
                description="This will permanently remove the user and cannot be undone."
                confirmLabel="Delete"
                loading={deleteMutation.isPending}
                onConfirm={() => deleteMutation.mutate(confirmDeleteId)}
                onCancel={() => setConfirmDeleteId(null)}
            />
        </div>
    );
};

export default Team;
