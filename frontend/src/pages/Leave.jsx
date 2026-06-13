import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { Calendar, User, X, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

const Leave = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [showApplyModal, setShowApplyModal] = useState(null); // null | "LEAVE" | "WFH"
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [selectedLeave, setSelectedLeave] = useState(null);

    // Fetch my leaves
    const { data: myLeaves = [] } = useQuery({
        queryKey: ["my-leaves"],
        queryFn: async () => {
            const res = await api.get("/leave/my");
            return res.data;
        }
    });

    // Fetch leave stats
    const { data: stats } = useQuery({
        queryKey: ["leave-stats"],
        queryFn: async () => {
            const res = await api.get("/leave/stats");
            return res.data;
        }
    });

    // Fetch pending leaves (for admins)
    const { data: pendingLeaves = [] } = useQuery({
        queryKey: ["pending-leaves"],
        queryFn: async () => {
            const res = await api.get("/leave/pending");
            return res.data;
        },
        enabled: user?.role === "SUPER_ADMIN" || user?.role === "ADMIN"
    });

    const getStatusBadge = (status) => {
        const styles = {
            PENDING: { bg: "bg-yellow-100", text: "text-yellow-700", icon: AlertCircle },
            APPROVED: { bg: "bg-green-100", text: "text-green-700", icon: CheckCircle2 },
            REJECTED: { bg: "bg-red-100", text: "text-red-700", icon: XCircle }
        };
        const style = styles[status];
        const Icon = style.icon;
        return (
            <span className={`px-3 py-1 text-xs font-semibold rounded-full ${style.bg} ${style.text} flex items-center gap-1 w-fit`}>
                <Icon className="h-3 w-3" />
                {status}
            </span>
        );
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    return (
        <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Leave Management</h1>
                        <p className="text-sm text-gray-500">Manage your leave applications</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowApplyModal("LEAVE")}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors"
                        >
                            Apply for Leave
                        </button>
                        <button
                            onClick={() => setShowApplyModal("WFH")}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors"
                        >
                            Apply WFH
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: "Total Applied", value: stats?.totalApplied || 0, color: "bg-indigo-50 text-indigo-600" },
                        { label: "Approved",      value: stats?.approved || 0,     color: "bg-emerald-50 text-emerald-600" },
                        { label: "Pending",       value: stats?.pending || 0,      color: "bg-amber-50 text-amber-600" },
                        { label: "Days Taken",    value: stats?.totalDaysTaken || 0, color: "bg-violet-50 text-violet-600" },
                    ].map(({ label, value, color }) => (
                        <div key={label} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                            <p className="text-xs font-medium text-gray-500">{label}</p>
                            <p className={`text-2xl font-bold mt-1 ${color.split(" ")[1]}`}>{value}</p>
                        </div>
                    ))}
                </div>

                {/* Pending Approvals (Admin Only) */}
                {user?.role === "SUPER_ADMIN" || user?.role === "ADMIN" && pendingLeaves.length > 0 && (
                    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-red-50">
                            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <AlertCircle className="h-5 w-5 text-orange-600" />
                                Pending Approvals ({pendingLeaves.length})
                            </h2>
                        </div>
                        <div className="divide-y divide-gray-200">
                            {pendingLeaves.map((leave) => (
                                <PendingLeaveCard key={leave.id} leave={leave} onUpdate={() => {
                                    queryClient.invalidateQueries({ queryKey: ["pending-leaves"] });
                                    queryClient.invalidateQueries({ queryKey: ["my-leaves"] });
                                }} />
                            ))}
                        </div>
                    </div>
                )}

                {/* My Leave Requests */}
                <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                    <div className="p-6 border-b border-gray-200">
                        <h2 className="text-xl font-bold text-gray-900">My Leave Requests</h2>
                    </div>
                    <div className="divide-y divide-gray-200">
                        {myLeaves.map((leave) => (
                            <div key={leave.id} className="p-6 hover:bg-gray-50 transition">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3">
                                            <Calendar className="h-5 w-5 text-purple-600" />
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-semibold text-gray-900">
                                                        {formatDate(leave.fromDate)} - {formatDate(leave.toDate)}
                                                    </p>
                                                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${leave.leaveType === "WFH" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                                                        {leave.leaveType === "WFH" ? "WFH" : "Leave"}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-500">{leave.totalDays} day(s)</p>
                                            </div>
                                        </div>
                                        <p className="text-sm text-gray-600 mt-2 ml-8">{leave.reason}</p>
                                        <div className="flex items-center gap-2 mt-3 ml-8">
                                            <User className="h-4 w-4 text-gray-400" />
                                            <p className="text-xs text-gray-500">
                                                Approvers: {leave.approvals.map(a => a.approver?.name || "Unknown").join(", ")}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        {getStatusBadge(leave.status)}
                                        <button
                                            onClick={() => {
                                                setSelectedLeave(leave);
                                                setShowInfoModal(true);
                                            }}
                                            className="text-xs text-blue-600 hover:underline"
                                        >
                                            View Details
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {myLeaves.length === 0 && (
                            <div className="p-12 text-center text-gray-500">
                                No leave requests found
                            </div>
                        )}
                    </div>
                </div>

                {/* Apply Leave Modal */}
                {showApplyModal && (
                    <ApplyLeaveModal
                        leaveType={showApplyModal}
                        onClose={() => setShowApplyModal(null)}
                        onSuccess={() => {
                            setShowApplyModal(null);
                            queryClient.invalidateQueries({ queryKey: ["my-leaves"] });
                            queryClient.invalidateQueries({ queryKey: ["leave-stats"] });
                        }}
                    />
                )}

                {/* Leave Info Modal */}
                {showInfoModal && selectedLeave && (
                    <LeaveInfoModal
                        leave={selectedLeave}
                        onClose={() => {
                            setShowInfoModal(false);
                            setSelectedLeave(null);
                        }}
                    />
                )}
        </div>
    );
};

// Apply Leave Modal Component
const ApplyLeaveModal = ({ onClose, onSuccess, leaveType = "LEAVE" }) => {
    const isWFH = leaveType === "WFH";
    const [formData, setFormData] = useState({
        fromDate: "",
        toDate: "",
        reason: "",
        approverIds: [],
        leaveType
    });

    // Fetch admins
    const { data: admins = [] } = useQuery({
        queryKey: ["admins"],
        queryFn: async () => {
            const res = await api.get("/users");
            return res.data.filter(u => u.role === "SUPER_ADMIN" || u.role === "ADMIN");
        }
    });

    const applyMutation = useMutation({
        mutationFn: (data) => api.post("/leave/apply", data),
        onSuccess: () => {
            toast.success(`${isWFH ? "WFH" : "Leave"} application submitted successfully!`);
            onSuccess();
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || `Failed to apply for ${isWFH ? "WFH" : "leave"}`);
        }
    });

    const calculateDays = () => {
        if (formData.fromDate && formData.toDate) {
            const from = new Date(formData.fromDate);
            const to = new Date(formData.toDate);
            const days = Math.ceil((to - from) / (1000 * 60 * 60 * 24)) + 1;
            return days > 0 ? days : 0;
        }
        return 0;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (formData.approverIds.length === 0) {
            toast.warning("Please select at least one manager");
            return;
        }
        applyMutation.mutate(formData);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className={`p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white`}>
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-gray-900">
                            {isWFH ? "Apply Work From Home" : "Apply for Leave"}
                        </h2>
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${isWFH ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                            {isWFH ? "WFH" : "Leave"}
                        </span>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">From Date *</label>
                            <input
                                type="date"
                                required
                                value={formData.fromDate}
                                onChange={(e) => setFormData({ ...formData, fromDate: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">To Date *</label>
                            <input
                                type="date"
                                required
                                value={formData.toDate}
                                onChange={(e) => setFormData({ ...formData, toDate: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    {formData.fromDate && formData.toDate && (
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                            <p className="text-sm text-purple-700">
                                <span className="font-semibold">Total Days:</span> {calculateDays()} day(s)
                            </p>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {isWFH ? "Reason for WFH *" : "Reason *"}
                        </label>
                        <textarea
                            required
                            rows="4"
                            value={formData.reason}
                            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder={isWFH ? "Briefly explain why you need to work from home..." : "Briefly explain the reason for your leave..."}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Select Reporting Managers *</label>
                        <div className="border border-gray-300 rounded-lg p-4 max-h-48 overflow-y-auto space-y-2">
                            {admins.map((admin) => (
                                <label key={admin.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.approverIds.includes(admin.id)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setFormData({ ...formData, approverIds: [...formData.approverIds, admin.id] });
                                            } else {
                                                setFormData({ ...formData, approverIds: formData.approverIds.filter(id => id !== admin.id) });
                                            }
                                        }}
                                        className="rounded text-purple-600 focus:ring-purple-500"
                                    />
                                    <div>
                                        <p className="font-medium text-gray-900">{admin.name}</p>
                                        <p className="text-xs text-gray-500">{admin.email}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={applyMutation.isPending}
                            className={`px-6 py-2 text-white rounded-lg hover:shadow-lg transition disabled:opacity-50 ${isWFH ? "bg-gradient-to-r from-indigo-500 to-purple-500" : "bg-gradient-to-r from-purple-600 to-blue-600"}`}
                        >
                            {applyMutation.isPending ? "Submitting..." : isWFH ? "Apply WFH" : "Apply Leave"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Leave Info Modal
const LeaveInfoModal = ({ leave, onClose }) => {
    const formatDate = (date) => new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-900">Leave Details</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div>
                        <p className="text-sm text-gray-500">Duration</p>
                        <p className="font-semibold text-gray-900">{formatDate(leave.fromDate)} - {formatDate(leave.toDate)}</p>
                        <p className="text-sm text-gray-600">{leave.totalDays} day(s)</p>
                    </div>

                    <div>
                        <p className="text-sm text-gray-500">Reason</p>
                        <p className="text-gray-900">{leave.reason}</p>
                    </div>

                    <div>
                        <p className="text-sm text-gray-500 mb-2">Approvers</p>
                        <div className="space-y-2">
                            {leave.approvals.map((approval) => (
                                <div key={approval.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                                    <div>
                                        <p className="font-medium text-gray-900">{approval.approver.name}</p>
                                        {approval.comments && (
                                            <p className="text-xs text-gray-600">{approval.comments}</p>
                                        )}
                                    </div>
                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${approval.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                            approval.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                                                'bg-yellow-100 text-yellow-700'
                                        }`}>
                                        {approval.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Pending Leave Card (for admins)
const PendingLeaveCard = ({ leave, onUpdate }) => {
    const [comments, setComments] = useState("");
    const [showComments, setShowComments] = useState(false);

    const approveMutation = useMutation({
        mutationFn: (data) => api.post(`/leave/approve/${leave.id}`, data),
        onSuccess: () => {
            toast.success("Leave approved");
            onUpdate();
            setShowComments(false);
        }
    });

    const rejectMutation = useMutation({
        mutationFn: (data) => api.post(`/leave/reject/${leave.id}`, data),
        onSuccess: () => {
            toast.success("Leave rejected");
            onUpdate();
            setShowComments(false);
        }
    });

    const formatDate = (date) => new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

    return (
        <div className="p-6">
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <User className="h-5 w-5 text-purple-600" />
                        <div>
                            <p className="font-semibold text-gray-900">{leave.user.name}</p>
                            <p className="text-sm text-gray-500">{leave.user.email}</p>
                        </div>
                    </div>
                    <div className="ml-8 mt-2">
                        <p className="text-sm font-medium text-gray-700">
                            {formatDate(leave.fromDate)} - {formatDate(leave.toDate)} ({leave.totalDays} days)
                        </p>
                        <p className="text-sm text-gray-600 mt-1">{leave.reason}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {!showComments ? (
                        <>
                            <button
                                onClick={() => approveMutation.mutate({ comments: "" })}
                                disabled={approveMutation.isPending}
                                className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                            >
                                Approve
                            </button>
                            <button
                                onClick={() => setShowComments(true)}
                                disabled={rejectMutation.isPending}
                                className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                            >
                                Reject
                            </button>
                        </>
                    ) : (
                        <div className="flex flex-col gap-2">
                            <input
                                type="text"
                                placeholder="Add comments (optional)"
                                value={comments}
                                onChange={(e) => setComments(e.target.value)}
                                className="px-3 py-1.5 border border-gray-300 rounded text-sm"
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={() => rejectMutation.mutate({ comments })}
                                    className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                                >
                                    Confirm Reject
                                </button>
                                <button
                                    onClick={() => setShowComments(false)}
                                    className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Leave;
