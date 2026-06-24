import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    Calendar, PhoneCall, CheckSquare, GraduationCap,
    FileText, Award, UploadCloud, ShieldCheck,
    CheckCircle2, AlertCircle, RefreshCw, Send, Loader2, ArrowRight, X, List
} from "lucide-react";
import api from "../../api/axios";

export default function StudentJourneyPanel({ lead, onChanged }) {
    const qc = useQueryClient();
    const [actionModal, setActionModal] = useState(null); // 'enquiry', 'follow_up', 'prospect', etc.
    const [loading, setLoading] = useState(false);
    const [formValues, setFormValues] = useState({});

    const salesDept = lead.leadDepartments?.find(ld => ld.department === "SALES");
    if (!salesDept) return null;

    const currentStage = salesDept.stage;
    const customFields = lead.customFields || {};

    const STAGE_CONFIGS = {
        ENQUIRY: {
            title: "Enquiry",
            color: "text-indigo-600 bg-indigo-50 border-indigo-200",
            icon: PhoneCall,
            buttonText: "Log First Call",
            requiredFields: ["Full Name", "WhatsApp", "Email", "Lead Source", "Preferred Destination Country"],
            instruction: "Must log at least one call note to proceed to follow-up."
        },
        FOLLOW_UP: {
            title: "Follow Up",
            color: "text-sky-600 bg-sky-50 border-sky-200",
            icon: Calendar,
            buttonText: "Schedule Next Call",
            requiredFields: ["Next Follow-up Date & Time", "Conversation Logs"],
            instruction: "Next follow-up date/time must be scheduled."
        },
        PROSPECT: {
            title: "Prospect",
            color: "text-blue-600 bg-blue-50 border-blue-200",
            icon: GraduationCap,
            buttonText: "Save Academic Details",
            requiredFields: ["IELTS/TOEFL Score", "Academic GPA", "Backlogs"],
            instruction: "Academic details must be filled to proceed to University Shortlisting."
        },
        UNIVERSITY_SHORTLISTING: {
            title: "University Shortlisting",
            color: "text-indigo-600 bg-indigo-50 border-indigo-200",
            icon: List,
            buttonText: "Choose Target Universities",
            requiredFields: ["Target Universities Chosen"],
            instruction: "Enter the shortlisted target universities."
        },
        APPLICATION: {
            title: "Application Process",
            color: "text-purple-600 bg-purple-50 border-purple-200",
            icon: FileText,
            buttonText: "Submit Application",
            requiredFields: ["SOP", "LOR", "Transcripts"],
            instruction: "All mandatory documents must be marked 'Uploaded'."
        },
        AWAITING_STATUS: {
            title: "Awaiting Status",
            color: "text-amber-600 bg-amber-50 border-amber-200",
            icon: CheckSquare,
            buttonText: "Update University Response",
            requiredFields: ["Application Ref ID", "Submission Date"],
            instruction: "Set response: Conditional/Unconditional Offer (advances to Deposit) or Reject (archives)."
        },
        DEPOSIT_STATUS: {
            title: "Deposit Payment",
            color: "text-teal-600 bg-teal-50 border-teal-200",
            icon: UploadCloud,
            buttonText: "Upload Deposit Receipt",
            requiredFields: ["Offer Letter Status", "Deposit Amount Due", "Deposit Receipt Status"],
            instruction: "Deposit receipt image or PDF status must be set to 'Uploaded'."
        },
        VISA_DOCUMENTATION: {
            title: "Visa Documentation",
            color: "text-cyan-600 bg-cyan-50 border-cyan-200",
            icon: ShieldCheck,
            buttonText: "Verify Visa File",
            requiredFields: ["Financial Proof Documents", "CAS/I-20 Form Number", "Manager Approval"],
            instruction: "Financial files must be verified and manager approval checkbox ticked."
        },
        VISA_STATUS: {
            title: "Visa Status",
            color: "text-orange-600 bg-orange-50 border-orange-200",
            icon: Award,
            buttonText: "Update Embassy Result",
            requiredFields: ["Visa Appointment Date", "Mock Interview Scorecard"],
            instruction: "Set embassy response: Approved (advances to Visa Approval) or Refused (archives)."
        },
        VISA_APPROVAL: {
            title: "Visa Approval",
            color: "text-emerald-600 bg-emerald-50 border-emerald-200",
            icon: CheckCircle2,
            buttonText: "Activate Post-Visa Teams",
            requiredFields: ["Copy of Approved Visa Passport Page", "Flight Departure Date"],
            instruction: "System action: Instantly push data to Loans, Accommodations, and Forex departments."
        },
        COMMISSION_INVOICING: {
            title: "Commission Invoicing",
            color: "text-green-600 bg-green-50 border-green-200",
            icon: Send,
            buttonText: "Send Invoice to University",
            requiredFields: ["1st Year Tuition Fee Value", "Commission Percentage (e.g. 10%)"],
            instruction: "System action: Pushes a billing alert to the Accounts Team."
        },
        ARCHIVE: {
            title: "Archive",
            color: "text-slate-600 bg-slate-50 border-slate-200",
            icon: AlertCircle,
            buttonText: "Re-activate Lead",
            requiredFields: ["Reason for Archiving / Close File"],
            instruction: "Lead is archived. Click to re-activate and move back to Enquiry."
        },
        FUTURE_PROSPECT: {
            title: "Future Prospects",
            color: "text-slate-600 bg-slate-50 border-slate-200",
            icon: Calendar,
            buttonText: "Set Remind Date",
            requiredFields: ["Deferred Intake Term", "Remind Date"],
            instruction: "Deferred follow-up for a later intake term."
        }
    };

    const config = STAGE_CONFIGS[currentStage];
    if (!config) return null;

    const Icon = config.icon;

    // Mutators
    const moveStageMut = useMutation({
        mutationFn: (stage) => api.patch(`/lead-departments/${salesDept.id}/stage`, { stage }).then((r) => r.data),
        onSuccess: () => {
            toast.success(`Journey advanced!`);
            onChanged();
            setActionModal(null);
        },
        onError: (e) => {
            console.error("moveStageMut error:", e);
            toast.error(e.response?.data?.message || e.response?.data?.error?.message || e.message || "Could not advance stage");
        },
    });

    const updateLeadMut = useMutation({
        mutationFn: (payload) => api.put(`/leads/${lead.id}`, payload).then((r) => r.data),
        onSuccess: () => {
            toast.success("Lead fields updated");
            onChanged();
        },
        onError: (e) => {
            console.error("updateLeadMut error:", e);
            toast.error(e.response?.data?.message || e.response?.data?.error?.message || e.message || "Failed to update fields");
        },
    });

    const saveCustomFieldsMut = useMutation({
        mutationFn: (fields) => api.patch(`/leads/${lead.id}/custom-fields`, { fields }).then((r) => r.data),
        onSuccess: () => {
            toast.success("Saved student details");
            onChanged();
        },
        onError: (e) => {
            console.error("saveCustomFieldsMut error:", e);
            toast.error(e.response?.data?.message || e.response?.data?.error?.message || e.message || "Failed to save details");
        },
    });

    // Submitting forms
    const handleActionSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (currentStage === "ENQUIRY") {
                // Log note
                await api.post(`/leads/${lead.id}/notes`, { content: formValues.noteContent || "First introductory call logged." });
                // Move stage
                await moveStageMut.mutateAsync("FOLLOW_UP");
            }
            else if (currentStage === "FOLLOW_UP") {
                if (actionModal === "schedule") {
                    await updateLeadMut.mutateAsync({
                        nextFollowUpAt: formValues.nextFollowUpAt ? new Date(formValues.nextFollowUpAt).toISOString() : null,
                    });
                    setActionModal(null);
                } else {
                    // Mark Interested directly (saves custom field)
                    await saveCustomFieldsMut.mutateAsync({
                        interested: true
                    });
                    setActionModal(null);
                }
            }
            else if (currentStage === "PROSPECT") {
                await saveCustomFieldsMut.mutateAsync({
                    ielts_toefl_score: formValues.ielts_toefl_score || "",
                    academic_gpa: formValues.academic_gpa || "",
                    backlogs: parseInt(formValues.backlogs, 10) || 0
                });
                await moveStageMut.mutateAsync("UNIVERSITY_SHORTLISTING");
            }
            else if (currentStage === "UNIVERSITY_SHORTLISTING") {
                await saveCustomFieldsMut.mutateAsync({
                    target_universities: formValues.target_universities || ""
                });
                await moveStageMut.mutateAsync("APPLICATION");
            }
            else if (currentStage === "APPLICATION") {
                await saveCustomFieldsMut.mutateAsync({
                    sop_status: formValues.sop_status ? "Uploaded" : "Pending",
                    lor_status: formValues.lor_status ? "Uploaded" : "Pending",
                    transcripts_status: formValues.transcripts_status ? "Uploaded" : "Pending"
                });
                await moveStageMut.mutateAsync("AWAITING_STATUS");
            }
            else if (currentStage === "AWAITING_STATUS") {
                // Saves custom fields which triggers auto stage transition in the backend!
                await saveCustomFieldsMut.mutateAsync({
                    application_ref_id: formValues.application_ref_id || "",
                    submission_date: formValues.submission_date || null,
                    university_response: formValues.university_response
                });
                toast.success(`University response updated to ${formValues.university_response}`);
                onChanged();
                setActionModal(null);
            }
            else if (currentStage === "DEPOSIT_STATUS") {
                await saveCustomFieldsMut.mutateAsync({
                    offer_letter_uploaded: formValues.offer_letter_uploaded ? "Uploaded" : "Pending",
                    deposit_amount_due: formValues.deposit_amount_due || "",
                    deposit_receipt_uploaded: formValues.deposit_receipt_uploaded ? "Uploaded" : "Pending"
                });
                await moveStageMut.mutateAsync("VISA_DOCUMENTATION");
            }
            else if (currentStage === "VISA_DOCUMENTATION") {
                await saveCustomFieldsMut.mutateAsync({
                    financial_proof_docs: formValues.financial_proof_docs || "",
                    cas_form_number: formValues.cas_form_number || "",
                    visa_manager_approved: !!formValues.visa_manager_approved
                });
                await moveStageMut.mutateAsync("VISA_STATUS");
            }
            else if (currentStage === "VISA_STATUS") {
                await saveCustomFieldsMut.mutateAsync({
                    visa_appointment_date: formValues.visa_appointment_date || null,
                    mock_interview_scorecard: formValues.mock_interview_scorecard || "",
                    embassy_result: formValues.embassy_result
                });
                toast.success(`Embassy result updated to ${formValues.embassy_result}`);
                onChanged();
                setActionModal(null);
            }
            else if (currentStage === "VISA_APPROVAL") {
                await saveCustomFieldsMut.mutateAsync({
                    approved_visa_passport: formValues.approved_visa_passport || "",
                    flight_departure_date: formValues.flight_departure_date || null
                });
                await moveStageMut.mutateAsync("COMMISSION_INVOICING");
            }
            else if (currentStage === "COMMISSION_INVOICING") {
                await saveCustomFieldsMut.mutateAsync({
                    first_year_tuition: formValues.first_year_tuition || "",
                    commission_percentage: formValues.commission_percentage || ""
                });
                // Completes the journey by archiving or keeping in commissions
                await moveStageMut.mutateAsync("ARCHIVE");
            }
            else if (currentStage === "ARCHIVE") {
                await moveStageMut.mutateAsync("ENQUIRY");
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const initModal = (modalName) => {
        setActionModal(modalName);
        if (currentStage === "ENQUIRY") {
            setFormValues({ noteContent: "" });
        }
        else if (currentStage === "FOLLOW_UP") {
            setFormValues({ nextFollowUpAt: lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt).toISOString().slice(0, 16) : "" });
        }
        else if (currentStage === "PROSPECT") {
            setFormValues({
                ielts_toefl_score: customFields.ielts_toefl_score || "",
                academic_gpa: customFields.academic_gpa || "",
                backlogs: customFields.backlogs || 0
            });
        }
        else if (currentStage === "UNIVERSITY_SHORTLISTING") {
            setFormValues({
                target_universities: customFields.target_universities || ""
            });
        }
        else if (currentStage === "APPLICATION") {
            setFormValues({
                sop_status: customFields.sop_status === "Uploaded",
                lor_status: customFields.lor_status === "Uploaded",
                transcripts_status: customFields.transcripts_status === "Uploaded"
            });
        }
        else if (currentStage === "AWAITING_STATUS") {
            setFormValues({
                application_ref_id: customFields.application_ref_id || "",
                submission_date: customFields.submission_date ? new Date(customFields.submission_date).toISOString().split("T")[0] : "",
                university_response: customFields.university_response || "Conditional Offer"
            });
        }
        else if (currentStage === "DEPOSIT_STATUS") {
            setFormValues({
                offer_letter_uploaded: customFields.offer_letter_uploaded === "Uploaded",
                deposit_amount_due: customFields.deposit_amount_due || "",
                deposit_receipt_uploaded: customFields.deposit_receipt_uploaded === "Uploaded"
            });
        }
        else if (currentStage === "VISA_DOCUMENTATION") {
            setFormValues({
                financial_proof_docs: customFields.financial_proof_docs || "",
                cas_form_number: customFields.cas_form_number || "",
                visa_manager_approved: customFields.visa_manager_approved === true || customFields.visa_manager_approved === "true"
            });
        }
        else if (currentStage === "VISA_STATUS") {
            setFormValues({
                visa_appointment_date: customFields.visa_appointment_date ? new Date(customFields.visa_appointment_date).toISOString().split("T")[0] : "",
                mock_interview_scorecard: customFields.mock_interview_scorecard || "",
                embassy_result: customFields.embassy_result || "Approved"
            });
        }
        else if (currentStage === "VISA_APPROVAL") {
            setFormValues({
                approved_visa_passport: customFields.approved_visa_passport || "",
                flight_departure_date: customFields.flight_departure_date ? new Date(customFields.flight_departure_date).toISOString().split("T")[0] : ""
            });
        }
        else if (currentStage === "COMMISSION_INVOICING") {
            setFormValues({
                first_year_tuition: customFields.first_year_tuition || "",
                commission_percentage: customFields.commission_percentage || ""
            });
        }
    };

    return (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
            {/* Header background glow */}
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-violet-100/30 blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-1.5">
                    <GraduationCap className="h-4 w-4 text-violet-600" />
                    <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Student Journey</h3>
                </div>
                <div className="flex items-center gap-1.5">
                    {(customFields.interested === true || customFields.interested === "true") && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Interested
                        </span>
                    )}
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${config.color}`}>
                        <Icon className="h-3 w-3 mr-1" />
                        {config.title}
                    </span>
                </div>
            </div>

            <div className="space-y-3.5">
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Required details</p>
                    <div className="flex flex-wrap gap-1.5">
                        {config.requiredFields.map(f => (
                            <span key={f} className="text-[10px] font-medium bg-white text-slate-600 border border-slate-200 px-2 py-0.5 rounded-lg shadow-2xs">
                                {f}
                            </span>
                        ))}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2 font-medium">
                        💡 {config.instruction}
                    </p>
                </div>

                {currentStage === "FOLLOW_UP" ? (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => initModal("schedule")}
                            className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl py-2.5 transition-all shadow-sm shadow-indigo-100 hover:scale-[1.01]"
                        >
                            <Calendar className="h-3.5 w-3.5" />
                            Schedule Next Call
                        </button>
                        <button
                            onClick={() => initModal("interested")}
                            className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl py-2.5 transition-all border border-indigo-200"
                        >
                            Mark Interested
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => initModal("standard")}
                        className="w-full inline-flex items-center justify-center gap-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl py-2.5 transition-all shadow-sm shadow-indigo-100 hover:scale-[1.01]"
                    >
                        {config.buttonText}
                        <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>

            {/* Stage Actions Modal */}
            {actionModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
                    onClick={() => setActionModal(null)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col p-6 animate-in fade-in zoom-in duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                            <h3 className="text-base font-bold text-slate-800">
                                {currentStage === "FOLLOW_UP" && actionModal === "interested" ? "Mark Lead as Interested" : config.buttonText}
                            </h3>
                            <button
                                onClick={() => setActionModal(null)}
                                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handleActionSubmit} className="space-y-4">
                            {/* ENQUIRY Note */}
                            {currentStage === "ENQUIRY" && (
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-500 uppercase">First Call Notes</label>
                                    <textarea
                                        required
                                        placeholder="Spoke with student. Interested in studying abroad, looking at Canada and UK. Budget is around 10-15 Lakhs."
                                        value={formValues.noteContent || ""}
                                        onChange={e => setFormValues({ ...formValues, noteContent: e.target.value })}
                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 min-h-[100px]"
                                    />
                                </div>
                            )}

                            {/* FOLLOW_UP DateTime */}
                            {currentStage === "FOLLOW_UP" && actionModal === "schedule" && (
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-500 uppercase">Next Follow-Up Date & Time</label>
                                    <input
                                        type="datetime-local"
                                        required
                                        value={formValues.nextFollowUpAt || ""}
                                        onChange={e => setFormValues({ ...formValues, nextFollowUpAt: e.target.value })}
                                        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                                    />
                                </div>
                            )}

                            {currentStage === "FOLLOW_UP" && actionModal === "interested" && (
                                <p className="text-sm text-slate-500 font-medium leading-relaxed">
                                    Are you sure you want to mark this lead as interested? This will tag the lead as <span className="font-semibold text-emerald-600">Interested</span> and keep them in the <span className="font-semibold text-sky-600">Follow Up</span> stage.
                                </p>
                            )}

                            {/* PROSPECT Academics */}
                            {currentStage === "PROSPECT" && (
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-500 uppercase">IELTS / TOEFL Score</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="e.g. IELTS 7.5 / TOEFL 100"
                                            value={formValues.ielts_toefl_score || ""}
                                            onChange={e => setFormValues({ ...formValues, ielts_toefl_score: e.target.value })}
                                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-500 uppercase">Academic GPA / Percentage</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="e.g. 8.5 CGPA / 82%"
                                            value={formValues.academic_gpa || ""}
                                            onChange={e => setFormValues({ ...formValues, academic_gpa: e.target.value })}
                                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-500 uppercase">Number of Backlogs</label>
                                        <input
                                            type="number"
                                            required
                                            min="0"
                                            value={formValues.backlogs || 0}
                                            onChange={e => setFormValues({ ...formValues, backlogs: e.target.value })}
                                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* UNIVERSITY_SHORTLISTING Form */}
                            {currentStage === "UNIVERSITY_SHORTLISTING" && (
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-500 uppercase">Target Universities Chosen</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="e.g. University of Toronto, UBC"
                                            value={formValues.target_universities || ""}
                                            onChange={e => setFormValues({ ...formValues, target_universities: e.target.value })}
                                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* APPLICATION Process Docs & Universities */}
                            {currentStage === "APPLICATION" && (
                                <div className="space-y-4">
                                    <div className="space-y-2.5 pt-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Upload Checklists</label>
                                        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={!!formValues.sop_status}
                                                onChange={e => setFormValues({ ...formValues, sop_status: e.target.checked })}
                                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-200"
                                            />
                                            SOP (Statement of Purpose) Uploaded
                                        </label>
                                        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={!!formValues.lor_status}
                                                onChange={e => setFormValues({ ...formValues, lor_status: e.target.checked })}
                                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-200"
                                            />
                                            LOR (Letter of Recommendation) Uploaded
                                        </label>
                                        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={!!formValues.transcripts_status}
                                                onChange={e => setFormValues({ ...formValues, transcripts_status: e.target.checked })}
                                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-200"
                                            />
                                            Academic Transcripts Uploaded
                                        </label>
                                    </div>
                                </div>
                            )}

                            {/* AWAITING_STATUS Response */}
                            {currentStage === "AWAITING_STATUS" && (
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-500 uppercase">Application Reference ID</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="e.g. APP-8947-CA"
                                            value={formValues.application_ref_id || ""}
                                            onChange={e => setFormValues({ ...formValues, application_ref_id: e.target.value })}
                                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-500 uppercase">Submission Date</label>
                                        <input
                                            type="date"
                                            required
                                            value={formValues.submission_date || ""}
                                            onChange={e => setFormValues({ ...formValues, submission_date: e.target.value })}
                                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-500 uppercase">University Response</label>
                                        <select
                                            value={formValues.university_response || "Conditional Offer"}
                                            onChange={e => setFormValues({ ...formValues, university_response: e.target.value })}
                                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-white"
                                        >
                                            <option value="Conditional Offer">Conditional Offer</option>
                                            <option value="Unconditional Offer">Unconditional Offer</option>
                                            <option value="Reject">Reject (Close/Archive)</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* DEPOSIT_STATUS Payment */}
                            {currentStage === "DEPOSIT_STATUS" && (
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-500 uppercase">Deposit Amount Due</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="e.g. $5,000 CAD / £3,000"
                                            value={formValues.deposit_amount_due || ""}
                                            onChange={e => setFormValues({ ...formValues, deposit_amount_due: e.target.value })}
                                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                                        />
                                    </div>
                                    <div className="space-y-2.5 pt-2">
                                        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={!!formValues.offer_letter_uploaded}
                                                onChange={e => setFormValues({ ...formValues, offer_letter_uploaded: e.target.checked })}
                                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-200"
                                            />
                                            Offer Letter Uploaded
                                        </label>
                                        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={!!formValues.deposit_receipt_uploaded}
                                                onChange={e => setFormValues({ ...formValues, deposit_receipt_uploaded: e.target.checked })}
                                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-200"
                                            />
                                            Deposit Payment Receipt Uploaded
                                        </label>
                                    </div>
                                </div>
                            )}

                            {/* VISA_DOCUMENTATION Verification */}
                            {currentStage === "VISA_DOCUMENTATION" && (
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-500 uppercase">Financial Proof Documents Details</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="e.g. Education loan sanction letter / Bank statement"
                                            value={formValues.financial_proof_docs || ""}
                                            onChange={e => setFormValues({ ...formValues, financial_proof_docs: e.target.value })}
                                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-500 uppercase">CAS / I-20 Form Number</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="e.g. CAS-9473-GB"
                                            value={formValues.cas_form_number || ""}
                                            onChange={e => setFormValues({ ...formValues, cas_form_number: e.target.value })}
                                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                                        />
                                    </div>
                                    <div className="pt-2">
                                        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none font-bold">
                                            <input
                                                type="checkbox"
                                                checked={!!formValues.visa_manager_approved}
                                                onChange={e => setFormValues({ ...formValues, visa_manager_approved: e.target.checked })}
                                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-200"
                                            />
                                            Visa Manager Approved File
                                        </label>
                                    </div>
                                </div>
                            )}

                            {/* VISA_STATUS embassy response */}
                            {currentStage === "VISA_STATUS" && (
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-500 uppercase">Visa Appointment Date</label>
                                        <input
                                            type="date"
                                            required
                                            value={formValues.visa_appointment_date || ""}
                                            onChange={e => setFormValues({ ...formValues, visa_appointment_date: e.target.value })}
                                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-500 uppercase">Mock Interview Scorecard</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="e.g. Passed 9/10 / Excellent mock"
                                            value={formValues.mock_interview_scorecard || ""}
                                            onChange={e => setFormValues({ ...formValues, mock_interview_scorecard: e.target.value })}
                                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-500 uppercase">Embassy Result</label>
                                        <select
                                            value={formValues.embassy_result || "Approved"}
                                            onChange={e => setFormValues({ ...formValues, embassy_result: e.target.value })}
                                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-white"
                                        >
                                            <option value="Approved">Approved</option>
                                            <option value="Refused">Refused (Close/Archive)</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* VISA_APPROVAL details */}
                            {currentStage === "VISA_APPROVAL" && (
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-500 uppercase">Approved Visa Passport Page Details</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="e.g. Passport details / Stamp verified"
                                            value={formValues.approved_visa_passport || ""}
                                            onChange={e => setFormValues({ ...formValues, approved_visa_passport: e.target.value })}
                                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-500 uppercase">Flight Departure Date</label>
                                        <input
                                            type="date"
                                            required
                                            value={formValues.flight_departure_date || ""}
                                            onChange={e => setFormValues({ ...formValues, flight_departure_date: e.target.value })}
                                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                                        />
                                    </div>
                                    <p className="text-[11px] text-blue-600 bg-blue-50 border border-blue-100 p-2.5 rounded-lg leading-relaxed font-semibold">
                                        ℹ️ System Action: Post-Visa teams (Loans, Accommodations, Forex) will be activated instantly on submit.
                                    </p>
                                </div>
                            )}

                            {/* COMMISSION_INVOICING details */}
                            {currentStage === "COMMISSION_INVOICING" && (
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-500 uppercase">1st Year Tuition Fee Value</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="e.g. $15,000 CAD / £12,500"
                                            value={formValues.first_year_tuition || ""}
                                            onChange={e => setFormValues({ ...formValues, first_year_tuition: e.target.value })}
                                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-500 uppercase">Commission Percentage</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="e.g. 10% / 12.5%"
                                            value={formValues.commission_percentage || ""}
                                            onChange={e => setFormValues({ ...formValues, commission_percentage: e.target.value })}
                                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                                        />
                                    </div>
                                    <p className="text-[11px] text-green-600 bg-green-50 border border-green-100 p-2.5 rounded-lg leading-relaxed font-semibold">
                                        🚀 System Action: Pushes alert to Accounts Team to invoice the university.
                                    </p>
                                </div>
                            )}

                            {/* Buttons */}
                            <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-3.5 mt-2">
                                <button
                                    type="button"
                                    onClick={() => setActionModal(null)}
                                    className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition-all shadow-sm shadow-indigo-100 flex items-center gap-1.5"
                                >
                                    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                                    Submit
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
