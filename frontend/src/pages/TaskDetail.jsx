import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/axios";
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
    Briefcase
} from "lucide-react";

const TaskDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

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
                    onClick={() => navigate("/tasks")}
                    className="mt-4 text-indigo-600 hover:text-indigo-800 font-medium"
                >
                    Back to Tasks
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-12">
            {/* Header / Breadcrumbs */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => navigate("/tasks")}
                    className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
                >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Back to Tasks
                </button>
                <div className="flex items-center gap-3">
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
                                                href={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001'}${file.fileUrl}`} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="p-2 hover:bg-white rounded-lg text-gray-400 hover:text-indigo-600 transition-colors shadow-sm bg-gray-100/50"
                                                title="View"
                                            >
                                                <ExternalLink className="h-4 w-4" />
                                            </a>
                                            <a 
                                                href={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001'}${file.fileUrl}`} 
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
                                    {new Date(task.createdAt).toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TaskDetail;
