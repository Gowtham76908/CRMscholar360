import { useQuery } from "@tanstack/react-query";
import { Loader2, Circle, Clock, User, Phone, Mail, FileText, CheckCircle, AlertCircle } from "lucide-react";
import api from "../api/axios";

const LeadActivityModal = ({ lead, onClose }) => {
    const { data: activities, isLoading } = useQuery({
        queryKey: ["lead-activities", lead.id],
        queryFn: async () => {
            const res = await api.get(`/leads/${lead.id}/activities`);
            return res.data;
        }
    });

    const getIcon = (action) => {
        if (action.includes("CREATED")) return <User className="h-5 w-5 text-blue-500" />;
        if (action.includes("STATUS")) return <CheckCircle className="h-5 w-5 text-green-500" />;
        if (action.includes("CALL")) return <Phone className="h-5 w-5 text-indigo-500" />;
        if (action.includes("EMAIL")) return <Mail className="h-5 w-5 text-amber-500" />;
        if (action.includes("NOTE")) return <FileText className="h-5 w-5 text-gray-500" />;
        if (action.includes("MERGED")) return <AlertCircle className="h-5 w-5 text-purple-500" />;
        return <Circle className="h-5 w-5 text-gray-400" />;
    };

    const formatAction = (action) => {
        return action.replace(/_/g, " ");
    };

    return (
        <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 max-w-lg w-full">
            <div className="sm:flex sm:items-start mb-4">
                <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-1" id="modal-title">
                        Activity Timeline
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">
                        History for <span className="font-semibold">{lead.name}</span>
                    </p>
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                    <span className="sr-only">Close</span>
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="mt-2 max-h-96 overflow-y-auto pr-2">
                {isLoading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                    </div>
                ) : activities?.length > 0 ? (
                    <div className="flow-root">
                        <ul className="-mb-8">
                            {activities.map((activity, activityIdx) => (
                                <li key={activity.id}>
                                    <div className="relative pb-8">
                                        {activityIdx !== activities.length - 1 ? (
                                            <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true"></span>
                                        ) : null}
                                        <div className="relative flex space-x-3">
                                            <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center ring-8 ring-white">
                                                {getIcon(activity.action)}
                                            </div>
                                            <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                                                <div>
                                                    <p className="text-sm text-gray-700 font-medium capitalize">
                                                        {formatAction(activity.action)}
                                                    </p>
                                                    {activity.metadata && (
                                                        <div className="mt-1 text-xs text-gray-500 bg-gray-50 p-2 rounded border border-gray-100 font-mono">
                                                            {/* Render specific interesting metadata fields */}
                                                            {activity.metadata.newStatus &&
                                                                <p>Changed to <span className="font-bold">{activity.metadata.newStatus}</span></p>
                                                            }
                                                            {activity.metadata.duration &&
                                                                <p>Duration: {activity.metadata.duration}s</p>
                                                            }
                                                            {/* Fallback for other metadata */}
                                                            {!activity.metadata.newStatus && !activity.metadata.duration &&
                                                                JSON.stringify(activity.metadata).substring(0, 100)
                                                            }
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="text-right text-xs whitespace-nowrap text-gray-500">
                                                    <time dateTime={activity.createdAt}>
                                                        {new Date(activity.createdAt).toLocaleDateString()}
                                                    </time>
                                                    <p>{new Date(activity.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                                    <p className="mt-1 font-medium text-gray-400">{activity.user?.name}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-500 text-sm">
                        No activity recorded yet.
                    </div>
                )}
            </div>
        </div>
    );
};

export default LeadActivityModal;
