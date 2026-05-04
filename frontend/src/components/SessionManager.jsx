import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Monitor, Smartphone, LogOut, Shield } from "lucide-react";
import api from "../api/axios";

const SessionManager = () => {
    const queryClient = useQueryClient();

    const { data: sessions, isLoading } = useQuery({
        queryKey: ["sessions"],
        queryFn: async () => {
            const res = await api.get("/sessions");
            return res.data;
        }
    });

    const logoutMutation = useMutation({
        mutationFn: async (userId) => {
            await api.post("/sessions/logout-all", { userId });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["sessions"] });
            alert("User logged out from all devices.");
        },
        onError: () => {
            alert("Failed to force logout.");
        }
    });

    const handleForceLogout = (userId) => {
        if (confirm("Are you sure? This will log the user out of all active sessions.")) {
            logoutMutation.mutate(userId);
        }
    };

    return (
        <div className="bg-white shadow rounded-lg p-6">
            <div className="mb-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Active Sessions</h3>
                <p className="text-sm text-gray-500 mt-1">Monitor and manage active user sessions across the platform.</p>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Device Info</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Active</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {sessions?.map((session) => (
                                <tr key={session.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">{session.user.name}</div>
                                        <div className="text-xs text-gray-500">{session.user.email}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-indigo-100 text-indigo-800 capitalize">
                                            {session.user.role.toLowerCase().replace("_", " ")}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <div className="flex items-center gap-2">
                                            <Monitor className="h-4 w-4 text-gray-400" />
                                            <span title={session.userAgent} className="truncate max-w-xs">{session.userAgent.includes("Mac") ? "Mac/iOS" : "Windows/Android"} {session.ipAddress}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {new Date(session.expiresAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        {session.user.role !== "SUPER_ADMIN" ? (
                                            <button
                                                onClick={() => handleForceLogout(session.user.id)}
                                                className="text-red-600 hover:text-red-900 inline-flex items-center"
                                                disabled={logoutMutation.isPending}
                                            >
                                                <LogOut className="h-4 w-4 mr-1" />
                                                Force Logout
                                            </button>
                                        ) : (
                                            <span className="text-gray-400 text-xs italic flex items-center justify-end">
                                                <Shield className="h-3 w-3 mr-1" /> Protected
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default SessionManager;
