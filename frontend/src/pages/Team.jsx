import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/axios";
import { Loader2, Trash2, Power, UserPlus, Shield, ToggleLeft, ToggleRight, Edit } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Modal } from "../components/Modal";
import AddUserForm from "../components/AddUserForm";
import EditUserForm from "../components/EditUserForm";

const Team = () => {
    const { user: currentUser } = useAuth();
    const queryClient = useQueryClient();
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);

    // Fetch Team
    const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(currentUser?.role);

    const { data: team, isLoading, error: teamError } = useQuery({
        queryKey: ["team"],
        queryFn: async () => {
            const res = await api.get("/team");
            return res.data;
        },
        enabled: isAdmin,
    });

    // Toggle Access Mutation (Active/Inactive)
    const toggleAccessMutation = useMutation({
        mutationFn: async (userId) => {
            return await api.patch(`/team/${userId}/toggle`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["team"] });
        },
        onError: (err) => alert(err.response?.data?.message || "Failed to toggle access"),
    });

    // Update Role Mutation
    const roleMutation = useMutation({
        mutationFn: async ({ userId, role }) => {
            return await api.patch(`/team/${userId}`, { role });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["team"] });
        },
        onError: (err) => alert(err.response?.data?.message || "Failed to update role"),
    });

    // Delete User Mutation
    const deleteMutation = useMutation({
        mutationFn: async (userId) => {
            return await api.delete(`/team/${userId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["team"] });
        },
        onError: (err) => alert(err.response?.data?.message || "Failed to delete user"),
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    if (teamError) {
        return (
            <div className="text-center py-20">
                <p className="text-red-600 font-semibold">Failed to load team.</p>
                <p className="text-gray-500 text-sm mt-1">{teamError.response?.data?.message || teamError.message}</p>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="text-center py-20">
                <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-gray-900">Access Denied</h2>
                <p className="text-gray-500 mt-2">Only Admins can manage the team.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Team Management</h1>
                    <p className="text-sm text-gray-500">Manage access and roles</p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add User
                </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Admin Access</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Login Access</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {team?.map((member) => (
                            <tr key={member.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs mr-3">
                                            {member.name[0]}
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-gray-900">{member.name}</div>
                                            <div className="text-xs text-gray-500">{member.email}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {member.role === "SUPER_ADMIN" ? (
                                        <span className="text-xs font-bold text-indigo-800 bg-indigo-100 px-2 py-1 rounded-full">SUPER ADMIN</span>
                                    ) : currentUser.role === "SUPER_ADMIN" ? (
                                        <button
                                            onClick={() => roleMutation.mutate({
                                                userId: member.id,
                                                role: member.role === "ADMIN" ? "EMPLOYEE" : "ADMIN"
                                            })}
                                            className="flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors"
                                            title="Toggle Admin Role"
                                        >
                                            {member.role === "ADMIN" ? (
                                                <ToggleRight className="h-8 w-8 text-indigo-600" />
                                            ) : (
                                                <ToggleLeft className="h-8 w-8 text-gray-400" />
                                            )}
                                        </button>
                                    ) : (
                                        <span className="text-xs text-gray-500">
                                            {member.role === "ADMIN" ? "Has Access" : "No Access"}
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <span className={`capitalize font-medium ${member.role === 'ADMIN' ? 'text-indigo-600' : 'text-gray-500'}`}>
                                        {member.role.toLowerCase().replace("_", " ")}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {member.department || "-"}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                        ${member.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {member.isActive ? "Active" : "Inactive"}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    {/* Actions for SUPER_ADMIN or ADMIN (with some restrictions?) */}
                                    <div className="flex justify-end gap-3">
                                        {currentUser.role === "SUPER_ADMIN" && (
                                            <button
                                                onClick={() => setEditingUser(member)}
                                                className="text-gray-400 hover:text-indigo-600"
                                                title="Edit Details"
                                            >
                                                <Edit className="h-4 w-4" />
                                            </button>
                                        )}

                                        {member.role !== "SUPER_ADMIN" && (
                                            <>
                                                <button
                                                    onClick={() => toggleAccessMutation.mutate(member.id)}
                                                    className={`text-gray-400 hover:text-gray-600 ${member.isActive ? 'text-green-600' : 'text-red-500'}`}
                                                    title={member.isActive ? "Deactivate" : "Activate"}
                                                >
                                                    <Power className="h-4 w-4" />
                                                </button>
                                                {currentUser.role === "SUPER_ADMIN" && (
                                                    <button
                                                        onClick={() => {
                                                            if (window.confirm("Are you sure you want to delete this user?")) {
                                                                deleteMutation.mutate(member.id)
                                                            }
                                                        }}
                                                        className="text-gray-400 hover:text-red-600"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Modal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                title="Add New Team Member"
            >
                <AddUserForm onClose={() => setIsAddModalOpen(false)} />
            </Modal>

            {/* Edit User Modal */}
            <Modal
                isOpen={!!editingUser}
                onClose={() => setEditingUser(null)}
                title="Edit Team Member"
            >
                {editingUser && (
                    <EditUserForm
                        user={editingUser}
                        onClose={() => setEditingUser(null)}
                    />
                )}
            </Modal>
        </div>
    );
};

export default Team;
