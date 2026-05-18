import { useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import api from "../api/axios";
import { toast } from "sonner";
import Dialog from "./ui/Dialog";

const MergeLeadModal = ({ leads, onClose, onSuccess }) => {
    if (!leads || leads.length < 2) return null;

    const [primaryId, setPrimaryId] = useState(leads[0].id);
    const [loading, setLoading] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    const secondaryId = leads.find(l => l.id !== primaryId).id;

    const handleMerge = async () => {
        setLoading(true);
        try {
            await api.post("/leads/merge", {
                primaryLeadId: primaryId,
                secondaryLeadId: secondaryId,
            });
            toast.success("Leads merged successfully");
            onSuccess();
            onClose();
        } catch (error) {
            toast.error("Merge failed: " + (error.response?.data?.message || error.message));
        } finally {
            setLoading(false);
            setConfirmOpen(false);
        }
    };

    return (
        <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 sm:mx-0 sm:h-10 sm:w-10">
                    <AlertTriangle className="h-6 w-6 text-yellow-600" aria-hidden="true" />
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                        Merge Duplicate Leads
                    </h3>
                    <div className="mt-2">
                        <p className="text-sm text-gray-500">
                            Select the primary lead. Activities, notes, and tasks from the secondary lead will be moved to the primary lead. The secondary lead will be marked as LOST/MERGED.
                        </p>

                        <div className="mt-4 grid grid-cols-2 gap-4">
                            {leads.map(lead => (
                                <div
                                    key={lead.id}
                                    onClick={() => setPrimaryId(lead.id)}
                                    className={`relative border rounded-lg p-4 cursor-pointer transition-all ${primaryId === lead.id ? 'border-indigo-600 ring-1 ring-indigo-600 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'}`}
                                >
                                    {primaryId === lead.id && (
                                        <div className="absolute top-2 right-2">
                                            <Check className="h-4 w-4 text-indigo-600" />
                                        </div>
                                    )}
                                    <p className="font-semibold text-gray-900">{lead.name}</p>
                                    <p className="text-sm text-gray-500">{lead.email}</p>
                                    <p className="text-xs text-gray-400 mt-1">Score: {lead.score}</p>
                                    <div className="mt-2">
                                        <span className="text-xs font-medium text-gray-500">
                                            {primaryId === lead.id ? "PRIMARY (Kept)" : "SECONDARY (Merged)"}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                    type="button"
                    onClick={() => setConfirmOpen(true)}
                    disabled={loading}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                    {loading ? "Merging..." : "Confirm Merge"}
                </button>
                <button
                    type="button"
                    onClick={onClose}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                >
                    Cancel
                </button>
            </div>

            <Dialog
                open={confirmOpen}
                variant="warning"
                title="Merge these leads?"
                description="Activities, notes, and tasks from the secondary lead will be moved to the primary lead. This cannot be undone."
                confirmLabel="Merge"
                loading={loading}
                onConfirm={handleMerge}
                onCancel={() => setConfirmOpen(false)}
            />
        </div>
    );
};

export default MergeLeadModal;
