import { useState } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { fileUrl } from "../utils/fileUrl";
import TaskModal from "../components/TaskModal";
import {
    ChevronLeft,
    Calendar,
    User,
    Tag,
    FileText,
    Download,
    ExternalLink,
    Clock,
    CheckCircle2,
    Circle,
    Loader2,
    Briefcase,
    Pencil,
    Trash2
} from "lucide-react";

const TaskDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    // Honor where the user came from (e.g. the Tasks calendar/list) so "Back"
    // returns there instead of always defaulting to the linked lead.
    const cameFrom = location.state?.from;
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const isAdmin = user?.role === "SUPER_ADMIN" || user?.role === "ADMIN";
    const [showEdit, setShowEdit] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const { data: task, isLoading, error } = useQuery({
        queryKey: ["tasks", id],
        queryFn: async () => {
            const res = await api.get(`/tasks/${id}`);
            return res.data;
        },
    });

    const statusMutation = useMutation({
        mutationFn: async (status) => {
            return await api.patch(`/tasks/${id}/status`, { status });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["tasks", id] });
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: () => api.delete(`/tasks/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
            task?.leadId ? navigate(`/leads/${task.leadId}`) : navigate("/tasks");
        },
    });

    const handleStatusToggle = () => {
        const newStatus = task.status === "PENDING" ? "COMPLETED" : "PENDING";
        statusMutation.mutate(newStatus);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    if (error || !task) {
        return (
            <div className="p-8 text-center">
                <h2 className="text-xl font-bold text-gray-900">Task not found</h2>
                <button 
                    onClick={() => navigate(-1)}
                    className="mt-4 text-indigo-600 hover:text-indigo-800 font-medium"
                >
                    Go Back
                </button>
            </div>
        );
    }

    return (
        <>
        <div className="max-w-5xl mx-auto space-y-6 pb-12">
            {/* Header / Breadcrumbs */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => {
                        if (cameFrom === "/tasks") return navigate("/tasks");
                        return task?.leadId ? navigate(`/leads/${task.leadId}`) : navigate("/tasks");
                    }}
                    className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
                >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    {cameFrom === "/tasks" ? "Back to Tasks" : task?.leadId ? "Back to Lead" : "Back to Tasks"}
                </button>
                <div className="flex items-center gap-2">
                    {isAdmin && (
                        <button
                            onClick={() => setShowEdit(true)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
                        >
                            <Pencil className="h-4 w-4" />
                            Edit
                        </button>
                    )}
                    <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-red-50 text-red-600 hover:bg-red-100 transition-all"
                    >
                        <Trash2 className="h-4 w-4" />
                        Delete
                    </button>
                    <button
                        onClick={handleStatusToggle}
                        disabled={statusMutation.isPending}
                        className={`inline-flex items-center px-4 py-2 rounded-xl text-sm font-bold transition-all
                            ${task.status === 'COMPLETED'
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100'}`}
                    >
                        {statusMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : task.status === 'COMPLETED' ? (
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                        ) : (
                            <Circle className="h-4 w-4 mr-2" />
                        )}
                        {task.status === 'COMPLETED' ? 'Mark as Pending' : 'Mark as Completed'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="p-8">
                            <div className="flex items-start justify-between gap-4">
                                <h1 className="text-3xl font-bold text-gray-900 tracking-tight leading-tight">
                                    {task.title}
                                </h1>
                            </div>
                            
                            <div className="mt-8">
                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Description</h3>
                                <div className="mt-4 text-gray-600 leading-relaxed whitespace-pre-wrap text-lg">
                                    {task.description || "No description provided."}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Files Section */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                            <FileText className="h-4 w-4 text-indigo-500" />
                            Attachments ({task.files?.length || 0})
                        </h3>
                        <div className="mt-6 space-y-3">
                            {task.files && task.files.length > 0 ? (
                                task.files.map((file) => (
                                    <div key={file.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-indigo-200 transition-all group">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 bg-white rounded-lg border border-gray-200 text-indigo-600 group-hover:text-indigo-700 group-hover:scale-110 transition-all shadow-sm">
                                                <FileText className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900 truncate max-w-[300px]">{file.fileName}</p>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">
                                                    {(file.fileSize / 1024 / 1024).toFixed(2)} MB • {file.mimeType.split('/')[1]}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <a 
                                                href={fileUrl(file.fileUrl)} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="p-2 hover:bg-white rounded-lg text-gray-400 hover:text-indigo-600 transition-colors shadow-sm bg-gray-100/50"
                                                title="View"
                                            >
                                                <ExternalLink className="h-4 w-4" />
                                            </a>
                                            <a 
                                                href={fileUrl(file.fileUrl)} 
                                                download={file.fileName}
                                                className="p-2 hover:bg-indigo-600 rounded-lg text-gray-400 hover:text-white transition-all shadow-sm bg-gray-100/50"
                                                title="Download"
                                            >
                                                <Download className="h-4 w-4" />
                                            </a>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-gray-400 italic py-4">No attachments linked to this task.</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sidebar Details */}
                <div className="space-y-6">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Metadata</p>
                            <div className="mt-4 space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-amber-50 rounded-lg text-amber-600 font-bold">
                                        <Calendar className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase">Due Date</p>
                                        <p className="text-sm font-bold text-gray-900">{new Date(task.dueDate).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 font-bold">
                                        <User className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase">Assigned To</p>
                                        <p className="text-sm font-bold text-gray-900">{task.assignedTo?.name || "Unassigned"}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-violet-50 rounded-lg text-violet-600 font-bold">
                                        <User className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase">Created By</p>
                                        <p className="text-sm font-bold text-gray-900">{task.createdBy?.name || "Automation"}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600 font-bold">
                                        <Tag className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase">Status</p>
                                        <p className={`text-sm font-bold ${task.status === 'COMPLETED' ? 'text-green-600' : 'text-amber-600'}`}>
                                            {task.status}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {task.lead && (
                            <div className="pt-6 border-t border-gray-50">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Linked Lead</p>
                                <div className="mt-4 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 group hover:border-indigo-300 transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-white rounded-lg text-indigo-600 shadow-sm">
                                            <Briefcase className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-900">{task.lead.name}</p>
                                            <p className="text-[10px] text-indigo-600 font-bold uppercase">{task.lead.email || task.lead.phone}</p>
                                        </div>
                                    </div>
                                    <Link 
                                        to={`/leads/${task.lead.id}`}
                                        className="mt-4 flex items-center justify-center gap-2 w-full py-2 bg-white border border-indigo-200 rounded-xl text-xs font-bold text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                                    >
                                        View Lead Profile
                                        <ExternalLink className="h-3 w-3" />
                                    </Link>
                                </div>
                            </div>
                        )}

                        <div className="pt-6 border-t border-gray-50">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Activity
                            </p>
                            <div className="mt-4">
                                <p className="text-[10px] text-gray-400 font-bold uppercase">Created</p>
                                <p className="text-[11px] font-bold text-gray-600 mt-0.5">
                                    {task.createdAt
                                        ? new Date(task.createdAt).toLocaleString()
                                        : new Date(task.updatedAt).toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Edit modal */}
        {showEdit && (
            <TaskModal
                task={task}
                onClose={() => {
                    setShowEdit(false);
                    queryClient.invalidateQueries({ queryKey: ["tasks", id] });
                }}
            />
        )}

        {/* Delete confirmation */}
        {showDeleteConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Task?</h3>
                    <p className="text-sm text-gray-500 mb-6">
                        "<span className="font-medium text-gray-700">{task.title}</span>" will be permanently deleted.
                    </p>
                    <div className="flex gap-3 justify-end">
                        <button
                            onClick={() => setShowDeleteConfirm(false)}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => deleteMutation.mutate()}
                            disabled={deleteMutation.isPending}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors disabled:opacity-50"
                        >
                            {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
};

export default TaskDetail;
