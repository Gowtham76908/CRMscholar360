import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api from "../api/axios";
import { GitMerge, Phone, Mail, Loader2, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";

function DuplicateGroup({ group, index }) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [expanded, setExpanded] = useState(true);
    const [primaryId, setPrimaryId] = useState(group.leads[0]?.id ?? "");

    const merge = useMutation({
        mutationFn: ({ primaryLeadId, secondaryLeadId }) =>
            api.post("/leads/merge", { primaryLeadId, secondaryLeadId }),
        onSuccess: () => {
            toast.success("Leads merged successfully");
            queryClient.invalidateQueries({ queryKey: ["lead-duplicates"] });
        },
        onError: (e) => toast.error(e.response?.data?.error?.message || e.response?.data?.message || "Merge failed"),
    });

    const nonPrimary = group.leads.filter(l => l.id !== primaryId);

    return (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            {/* Group header */}
            <button
                onClick={() => setExpanded(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200 hover:bg-gray-100 transition-colors text-left"
            >
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Group {index + 1}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        group.type === "phone" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                    }`}>
                        {group.type === "phone" ? <><Phone className="h-3 w-3 inline mr-1" />Same phone</> : <><Mail className="h-3 w-3 inline mr-1" />Same email</>}
                    </span>
                    <span className="text-xs text-gray-500">{group.value}</span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">{group.leads.length} leads</span>
                    {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </div>
            </button>

            {expanded && (
                <div className="p-4 space-y-3">
                    {/* Primary selector */}
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Select primary lead (kept after merge)
                    </p>
                    <div className="space-y-2">
                        {group.leads.map(lead => (
                            <div
                                key={lead.id}
                                className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                                    primaryId === lead.id
                                        ? "border-indigo-400 bg-indigo-50"
                                        : "border-gray-100 hover:border-gray-300"
                                }`}
                                onClick={() => setPrimaryId(lead.id)}
                            >
                                <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                    primaryId === lead.id ? "border-indigo-500 bg-indigo-500" : "border-gray-300"
                                }`}>
                                    {primaryId === lead.id && <div className="h-2 w-2 rounded-full bg-white" />}
                                </div>
                                <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 text-xs font-bold text-indigo-700">
                                    {lead.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 truncate">{lead.name}</p>
                                    <p className="text-xs text-gray-500 truncate">
                                        {[lead.phone, lead.email].filter(Boolean).join(" · ")}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {lead.leadDepartments?.[0] && (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                                            {lead.leadDepartments[0].stage?.replace(/_/g, " ")}
                                        </span>
                                    )}
                                    <button
                                        onClick={e => { e.stopPropagation(); navigate(`/leads/${lead.id}`); }}
                                        className="text-xs text-indigo-500 hover:underline"
                                    >
                                        View
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Merge actions */}
                    {nonPrimary.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100">
                            {nonPrimary.map(dup => (
                                <button
                                    key={dup.id}
                                    onClick={() => {
                                        if (!window.confirm(`Merge "${dup.name}" into the primary lead? This cannot be undone.`)) return;
                                        merge.mutate({ primaryLeadId: primaryId, secondaryLeadId: dup.id });
                                    }}
                                    disabled={merge.isPending}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                                >
                                    {merge.isPending
                                        ? <Loader2 className="h-3 w-3 animate-spin" />
                                        : <GitMerge className="h-3 w-3" />
                                    }
                                    Merge "{dup.name}" into primary
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function Duplicates() {
    const { data, isLoading, isError } = useQuery({
        queryKey: ["lead-duplicates"],
        queryFn: () => api.get("/leads/duplicates").then(r => r.data),
    });

    const groups = data?.groups ?? [];

    return (
        <div className="space-y-5">
            <header>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Duplicate Leads</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                    Leads sharing the same phone number or email address. Select a primary lead and merge duplicates into it.
                </p>
            </header>

            {isLoading && (
                <div className="flex items-center gap-2 text-sm text-gray-500 py-8 justify-center">
                    <Loader2 className="h-5 w-5 animate-spin" /> Scanning for duplicates…
                </div>
            )}

            {isError && (
                <div className="flex items-center gap-2 text-red-500 py-8 justify-center text-sm">
                    <AlertCircle className="h-4 w-4" /> Failed to load duplicates.
                </div>
            )}

            {!isLoading && !isError && groups.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 gap-3 bg-white border border-gray-200 rounded-xl">
                    <div className="h-16 w-16 rounded-full bg-green-50 flex items-center justify-center">
                        <GitMerge className="h-8 w-8 text-green-400" />
                    </div>
                    <p className="text-base font-semibold text-gray-800">Your data is clean</p>
                    <p className="text-sm text-gray-400 text-center max-w-xs">
                        No duplicate phone numbers or emails found across all leads.
                    </p>
                </div>
            )}

            {groups.length > 0 && (
                <>
                    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        Found <strong>{groups.length} duplicate group{groups.length !== 1 ? "s" : ""}</strong>.
                        Merging moves all notes, tasks, and activities to the primary lead and removes the duplicate.
                    </div>
                    <div className="space-y-3">
                        {groups.map((group, i) => (
                            <DuplicateGroup key={`${group.type}-${group.value}`} group={group} index={i} />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
