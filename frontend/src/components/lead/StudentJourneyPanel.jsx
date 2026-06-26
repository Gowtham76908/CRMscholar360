import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    Calendar, PhoneCall, CheckSquare, GraduationCap,
    FileText, Award, UploadCloud, ShieldCheck,
    CheckCircle2, AlertCircle, RefreshCw, Send, Loader2, ArrowRight, X, List, Save
} from "lucide-react";
import api from "../../api/axios";

const EXCLUDED_KEYS = new Set([
    "shortlisted_universities",
    "target_universities",
    "univ_country",
    "univ_name",
    "univ_course",
    "univ_link",
    "sop_status",
    "lor_status",
    "transcripts_status",
    "application_ref_id",
    "submission_date",
    "university_response",
    "offer_letter_uploaded",
    "deposit_amount_due",
    "deposit_receipt_uploaded",
    "financial_proof_docs",
    "cas_form_number",
    "visa_manager_approved",
    "visa_appointment_date",
    "mock_interview_scorecard",
    "embassy_result",
    "approved_visa_passport",
    "flight_departure_date",
    "first_year_tuition",
    "commission_percentage",
    "archive_reason",
    "deferred_intake_term",
    "remind_date"
]);

const SYSTEM_KEYS = new Set([
    "name", "phone", "email", "company", "source",
    "enquiryType", "biodata", "jobTitle", "linkedinUrl", "category",
]);

export default function StudentJourneyPanel({ lead, onChanged }) {
    const qc = useQueryClient();
    const navigate = useNavigate();
    const [actionModal, setActionModal] = useState(null); // 'enquiry', 'follow_up', 'prospect', etc.
    const [loading, setLoading] = useState(false);
    const [formValues, setFormValues] = useState({});

    const [newCountryIndex, setNewCountryIndex] = useState(null);
    const [newCountryVal, setNewCountryVal] = useState("");
    const [newUnivIndex, setNewUnivIndex] = useState(null);
    const [newUnivVal, setNewUnivVal] = useState("");

    const salesDept = lead.leadDepartments?.find(ld => ld.department === "SALES");
    if (!salesDept) return null;

    const currentStage = salesDept.stage;
    const customFields = lead.customFields || {};

    const { data: countries = [], refetch: refetchCountries } = useQuery({
        queryKey: ["countries-list"],
        queryFn: () => api.get("/countries").then(r => r.data),
        enabled: currentStage === "UNIVERSITY_SHORTLISTING" || currentStage === "APPLICATION",
    });

    const { data: allDefs = [] } = useQuery({
        queryKey: ["lead-fields"],
        queryFn: () => api.get("/custom-fields").then(r => r.data),
    });

    const updateUniversityField = (index, field, value) => {
        setFormValues(prev => {
            const list = [...(prev.universities || [])];
            list[index] = { ...list[index], [field]: value };
            return { ...prev, universities: list };
        });
    };

    const addCountryMut = useMutation({
        mutationFn: (name) => api.post("/countries", { name }).then(r => r.data),
        onSuccess: (newCountry) => {
            refetchCountries();
            if (newCountryIndex !== null) {
                updateUniversityField(newCountryIndex, "univ_country", newCountry.name);
                updateUniversityField(newCountryIndex, "univ_name", "");
            }
            setNewCountryIndex(null);
            setNewCountryVal("");
            toast.success("Country added successfully");
        },
        onError: (e) => {
            toast.error(e.response?.data?.message || "Failed to add country");
        }
    });

    const addUnivMut = useMutation({
        mutationFn: ({ countryId, name }) => api.post(`/countries/${countryId}/universities`, { name }).then(r => r.data),
        onSuccess: (newUniv) => {
            refetchCountries();
            if (newUnivIndex !== null) {
                updateUniversityField(newUnivIndex, "univ_name", newUniv.name);
            }
            setNewUnivIndex(null);
            setNewUnivVal("");
            toast.success("University added successfully");
        },
        onError: (e) => {
            toast.error(e.response?.data?.message || "Failed to add university");
        }
    });

    const STAGE_CONFIGS = {
        ENQUIRY: {
            title: "Enquiry",
            color: "text-indigo-600 bg-indigo-50 border-indigo-200",
            icon: FileText,
            buttonText: "Add Enquiry Note",
            requiredFields: ["Full Name", "WhatsApp", "Email", "Lead Source", "Preferred Destination Country"],
            instruction: "Must add at least one note message to proceed to follow-up."
        },
        FOLLOW_UP: {
            title: "Follow Up",
            color: "text-sky-600 bg-sky-50 border-sky-200",
            icon: Calendar,
            buttonText: "Schedule Next Call",
            requiredFields: ["Resume File"],
            instruction: "Resume must be uploaded to proceed to Prospect."
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
            requiredFields: ["Country", "University Name", "Course", "University Link"],
            instruction: "Enter the shortlisted target university details."
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

    // Save without validation for APPLICATION stage
    const handleApplicationSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const rawList = formValues.universities || [];
            
            // Case normalization
            const list = rawList.map(univ => {
                const matchedCountry = countries.find(c => c.name.toLowerCase() === univ.univ_country?.toLowerCase());
                const matchedUniv = matchedCountry?.universities?.find(u => u.name.toLowerCase() === univ.univ_name?.toLowerCase());
                return {
                    ...univ,
                    univ_country: matchedCountry ? matchedCountry.name : univ.univ_country,
                    univ_name: matchedUniv ? matchedUniv.name : univ.univ_name
                };
            });
            
            const primary = list[0] || {};
            
            await saveCustomFieldsMut.mutateAsync({
                sop_status: formValues.sop_status ? "Uploaded" : (customFields.sop_status || "Pending"),
                lor_status: formValues.lor_status ? "Uploaded" : (customFields.lor_status || "Pending"),
                transcripts_status: formValues.transcripts_status ? "Uploaded" : (customFields.transcripts_status || "Pending"),
                univ_country: primary.univ_country || "",
                univ_name: primary.univ_name || "",
                univ_course: primary.univ_course || "",
                univ_link: primary.univ_link || "",
                shortlisted_universities: list
            });
            toast.success("Application data saved successfully");
            setActionModal(null);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Save without validation for AWAITING_STATUS stage
    const handleAwaitingStatusSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await saveCustomFieldsMut.mutateAsync({
                shortlisted_universities: formValues.universities || []
            });
            toast.success("University responses saved successfully");
            setActionModal(null);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Submitting forms
    const handleActionSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (currentStage === "ENQUIRY") {
                // Log note
                await api.post(`/leads/${lead.id}/notes`, { content: formValues.noteContent || "Enquiry note added." });
                toast.success("Enquiry note saved");
                onChanged();
                setActionModal(null);
            }
            else if (currentStage === "FOLLOW_UP") {
                await moveStageMut.mutateAsync("PROSPECT");
            }
            else if (currentStage === "PROSPECT") {
                const score = formValues.ielts_toefl_score;
                const gpa = formValues.academic_gpa;
                const backlogs = formValues.backlogs;
                if (!score || !String(score).trim() || !gpa || !String(gpa).trim() || backlogs === undefined || backlogs === null || String(backlogs).trim() === "") {
                    toast.error("Please fill in all education details (IELTS/TOEFL Score, Academic GPA, Backlogs).");
                    setLoading(false);
                    return;
                }
                await saveCustomFieldsMut.mutateAsync({
                    ielts_toefl_score: formValues.ielts_toefl_score || "",
                    academic_gpa: formValues.academic_gpa || "",
                    backlogs: parseInt(formValues.backlogs, 10) || 0
                });
                // Stage progression is manual — save the education details but do NOT
                // auto-advance to University Shortlisting. The user moves it forward
                // explicitly via the "Move to next stage" control.
                toast.success("Education details saved");
                onChanged();
                setActionModal(null);
            }
            else if (currentStage === "UNIVERSITY_SHORTLISTING") {
                const rawList = formValues.universities || [];
                
                // Validate general academic fields explicitly
                const score = formValues.ielts_toefl_score;
                const gpa = formValues.academic_gpa;
                const backlogs = formValues.backlogs;
                if (!score || !String(score).trim() || !gpa || !String(gpa).trim() || backlogs === undefined || backlogs === null || String(backlogs).trim() === "") {
                    toast.error("Please fill in all education details (IELTS/TOEFL Score, Academic GPA, Backlogs).");
                    setLoading(false);
                    return;
                }
                
                // Validate universities shortlist
                if (rawList.length === 0) {
                    toast.error("Please add at least one shortlisted university.");
                    setLoading(false);
                    return;
                }
                
                for (let i = 0; i < rawList.length; i++) {
                    const u = rawList[i];
                    if (!u.univ_country?.trim() || !u.univ_name?.trim() || !u.univ_course?.trim() || !u.univ_link?.trim()) {
                        toast.error(`Please fill in all details for University #${i + 1}.`);
                        setLoading(false);
                        return;
                    }
                }
                
                // Case normalization for shortlisted universities
                const list = rawList.map(univ => {
                    const matchedCountry = countries.find(c => c.name.toLowerCase() === univ.univ_country?.toLowerCase());
                    const matchedUniv = matchedCountry?.universities?.find(u => u.name.toLowerCase() === univ.univ_name?.toLowerCase());
                    return {
                        ...univ,
                        univ_country: matchedCountry ? matchedCountry.name : univ.univ_country,
                        univ_name: matchedUniv ? matchedUniv.name : univ.univ_name
                    };
                });
                
                const primary = list[0] || {};
                
                const patchPayload = {
                    univ_country: primary.univ_country || "",
                    univ_name: primary.univ_name || "",
                    univ_course: primary.univ_course || "",
                    univ_link: primary.univ_link || "",
                    shortlisted_universities: list
                };
                
                // Populate all other custom fields dynamically from formValues
                allDefs.forEach(def => {
                    if (!EXCLUDED_KEYS.has(def.fieldKey) && !def.isSystem && !SYSTEM_KEYS.has(def.fieldKey)) {
                        patchPayload[def.fieldKey] = formValues[def.fieldKey] !== undefined ? formValues[def.fieldKey] : (customFields[def.fieldKey] ?? "");
                    }
                });
                
                await saveCustomFieldsMut.mutateAsync(patchPayload);
                // Stage progression is manual — save the shortlisted universities but do
                // NOT auto-advance to Application. The user moves it forward explicitly
                // via the "Move to next stage" control.
                toast.success("University shortlist saved");
                onChanged();
                setActionModal(null);
            }
            else if (currentStage === "APPLICATION") {
                const rawList = formValues.universities || [];
                
                // Validate document checklist
                if (!formValues.sop_status || !formValues.lor_status || !formValues.transcripts_status) {
                    toast.error("Please ensure SOP, LOR, and Academic Transcripts are all marked as Uploaded.");
                    setLoading(false);
                    return;
                }
                
                // Validate shortlisted universities completed status
                if (rawList.length === 0) {
                    toast.error("At least one target university must be shortlisted.");
                    setLoading(false);
                    return;
                }
                
                const allCompleted = rawList.every(u => u.completed);
                if (!allCompleted) {
                    toast.error("All target universities must have their status marked as Completed.");
                    setLoading(false);
                    return;
                }
                
                // Case normalization
                const list = rawList.map(univ => {
                    const matchedCountry = countries.find(c => c.name.toLowerCase() === univ.univ_country?.toLowerCase());
                    const matchedUniv = matchedCountry?.universities?.find(u => u.name.toLowerCase() === univ.univ_name?.toLowerCase());
                    return {
                        ...univ,
                        univ_country: matchedCountry ? matchedCountry.name : univ.univ_country,
                        univ_name: matchedUniv ? matchedUniv.name : univ.univ_name
                    };
                });
                
                const primary = list[0] || {};
                
                await saveCustomFieldsMut.mutateAsync({
                    sop_status: "Uploaded",
                    lor_status: "Uploaded",
                    transcripts_status: "Uploaded",
                    univ_country: primary.univ_country || "",
                    univ_name: primary.univ_name || "",
                    univ_course: primary.univ_course || "",
                    univ_link: primary.univ_link || "",
                    shortlisted_universities: list
                });
                await moveStageMut.mutateAsync("AWAITING_STATUS");
            }
            else if (currentStage === "AWAITING_STATUS") {
                // Save the updated universities with their response data
                await saveCustomFieldsMut.mutateAsync({
                    shortlisted_universities: formValues.universities || []
                });
                toast.success("University responses updated successfully");
                onChanged();
                setActionModal(null);
            }
            else if (currentStage === "DEPOSIT_STATUS") {
                await saveCustomFieldsMut.mutateAsync({
                    offer_letter_uploaded: formValues.offer_letter_uploaded ? "Uploaded" : "Pending",
                    deposit_amount_due: formValues.deposit_amount_due || "",
                    deposit_receipt_uploaded: formValues.deposit_receipt_uploaded ? "Uploaded" : "Pending"
                });
                // Stage progression is manual — save the deposit details but do NOT
                // auto-advance to Visa Documentation. The user moves it forward
                // explicitly via the "Move to next stage" control.
                toast.success("Deposit details saved");
                onChanged();
                setActionModal(null);
            }
            else if (currentStage === "VISA_DOCUMENTATION") {
                await saveCustomFieldsMut.mutateAsync({
                    financial_proof_docs: formValues.financial_proof_docs || "",
                    cas_form_number: formValues.cas_form_number || "",
                    visa_manager_approved: !!formValues.visa_manager_approved
                });
                toast.success("Visa documentation details saved");
                onChanged();
                setActionModal(null);
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
                // Don't move the stage here — the lead advances to Commission Invoicing
                // automatically once a commission invoice for this lead is fully paid.
                // Send the consultant to invoicing to raise that invoice now.
                setActionModal(null);
                toast.success("Visa details saved. Raise the commission invoice — the lead moves to Commission Invoicing once it's fully paid.");
                navigate(`/invoices?leadId=${lead.id}&newInvoice=1`);
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
            const existingShortlist = Array.isArray(customFields.shortlisted_universities)
                ? [...customFields.shortlisted_universities]
                : [];
            if (existingShortlist.length === 0 && customFields.univ_name) {
                existingShortlist.push({
                    univ_country: customFields.univ_country || "",
                    univ_name: customFields.univ_name || "",
                    univ_course: customFields.univ_course || "",
                    univ_link: customFields.univ_link || ""
                });
            }
            if (existingShortlist.length === 0) {
                existingShortlist.push({
                    univ_country: "",
                    univ_name: "",
                    univ_course: "",
                    univ_link: ""
                });
            }
            const initValues = {
                universities: existingShortlist
            };
            allDefs.forEach(def => {
                if (!EXCLUDED_KEYS.has(def.fieldKey) && !def.isSystem && !SYSTEM_KEYS.has(def.fieldKey)) {
                    initValues[def.fieldKey] = customFields[def.fieldKey] !== undefined ? customFields[def.fieldKey] : (def.type === "CHECKBOX" ? false : def.type === "NUMBER" ? 0 : "");
                }
            });
            setFormValues(initValues);
        }
        else if (currentStage === "APPLICATION") {
            const existingShortlist = Array.isArray(customFields.shortlisted_universities)
                ? [...customFields.shortlisted_universities]
                : [];
            if (existingShortlist.length === 0 && customFields.univ_name) {
                existingShortlist.push({
                    univ_country: customFields.univ_country || "",
                    univ_name: customFields.univ_name || "",
                    univ_course: customFields.univ_course || "",
                    univ_link: customFields.univ_link || "",
                    completed: false
                });
            }
            setFormValues({
                sop_status: customFields.sop_status === "Uploaded",
                lor_status: customFields.lor_status === "Uploaded",
                transcripts_status: customFields.transcripts_status === "Uploaded",
                universities: existingShortlist
            });
        }
        else if (currentStage === "AWAITING_STATUS") {
            const existingShortlist = Array.isArray(customFields.shortlisted_universities)
                ? customFields.shortlisted_universities.map(univ => ({
                    ...univ,
                    application_ref_id: univ.application_ref_id || "",
                    submission_date: univ.submission_date ? new Date(univ.submission_date).toISOString().split("T")[0] : "",
                    university_response: univ.university_response || "Conditional Offer"
                }))
                : [];
            setFormValues({
                universities: existingShortlist
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

                <button
                    onClick={() => initModal("standard")}
                    className="w-full inline-flex items-center justify-center gap-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl py-2.5 transition-all shadow-sm shadow-indigo-100 hover:scale-[1.01]"
                >
                    {config.buttonText}
                    <ArrowRight className="h-3.5 w-3.5" />
                </button>
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

                        <form onSubmit={handleActionSubmit} className="flex flex-col flex-1 min-h-0">
                            <div className="flex-1 overflow-y-auto max-h-[60vh] pr-1.5 space-y-4">
                            {/* ENQUIRY Note */}
                            {currentStage === "ENQUIRY" && (
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-500 uppercase">Enquiry Note Message</label>
                                    <textarea
                                        required
                                        placeholder="Spoke with student. Interested in studying abroad, looking at Canada and UK. Budget is around 10-15 Lakhs."
                                        value={formValues.noteContent || ""}
                                        onChange={e => setFormValues({ ...formValues, noteContent: e.target.value })}
                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 min-h-[100px]"
                                    />
                                </div>
                            )}

                            {/* FOLLOW_UP Confirmation */}
                            {currentStage === "FOLLOW_UP" && (
                                <p className="text-sm text-slate-500 font-medium leading-relaxed">
                                    Are you sure you want to move this lead to the <span className="font-semibold text-blue-600">Prospect</span> stage? This confirms that you have received the student's resume.
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
                                <div className="space-y-6">
                                    {/* Education/Academic Details */}
                                    <div className="space-y-4 p-4 border border-slate-100 bg-slate-50 rounded-2xl">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Education / Academic Details</label>
                                        {allDefs
                                            .filter(def => !EXCLUDED_KEYS.has(def.fieldKey) && !def.isSystem && !SYSTEM_KEYS.has(def.fieldKey))
                                            .map(def => {
                                                const isRequired = def.fieldKey === "ielts_toefl_score" || def.fieldKey === "academic_gpa" || def.fieldKey === "backlogs" || def.required;
                                                return (
                                                    <div key={def.id} className="space-y-1.5">
                                                        <label className="text-xs font-semibold text-slate-500 uppercase">
                                                            {def.name} {isRequired && <span className="text-rose-500">*</span>}
                                                        </label>
                                                        {def.type === "SELECT" ? (
                                                            <select
                                                                required={isRequired}
                                                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-white"
                                                                value={formValues[def.fieldKey] ?? ""}
                                                                onChange={e => setFormValues(v => ({ ...v, [def.fieldKey]: e.target.value }))}
                                                            >
                                                                <option value="">— Select —</option>
                                                                {(def.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                                                            </select>
                                                        ) : def.type === "TEXTAREA" ? (
                                                            <textarea
                                                                required={isRequired}
                                                                rows={3}
                                                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 resize-none bg-white font-medium"
                                                                value={formValues[def.fieldKey] ?? ""}
                                                                onChange={e => setFormValues(v => ({ ...v, [def.fieldKey]: e.target.value }))}
                                                            />
                                                        ) : def.type === "CHECKBOX" ? (
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="checkbox"
                                                                    id={`cf-${def.fieldKey}`}
                                                                    checked={!!formValues[def.fieldKey]}
                                                                    onChange={e => setFormValues(v => ({ ...v, [def.fieldKey]: e.target.checked }))}
                                                                    className="rounded border-slate-300 text-indigo-655 focus:ring-indigo-200 h-4 w-4"
                                                                />
                                                                <label htmlFor={`cf-${def.fieldKey}`} className="text-sm text-slate-700 cursor-pointer select-none">
                                                                    Confirm {def.name}
                                                                </label>
                                                            </div>
                                                        ) : (
                                                            <input
                                                                required={isRequired}
                                                                type={def.type === "NUMBER" ? "number" : def.type === "DATE" ? "date" : "text"}
                                                                min={def.type === "NUMBER" ? "0" : undefined}
                                                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-white font-medium"
                                                                value={formValues[def.fieldKey] ?? ""}
                                                                onChange={e => setFormValues(v => ({ ...v, [def.fieldKey]: e.target.value }))}
                                                            />
                                                        )}
                                                    </div>
                                                );
                                            })}
                                    </div>

                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Shortlisted Target Universities</label>
                                    {(formValues.universities || []).map((univ, index) => (
                                        <div key={index} className="space-y-4 p-4 border border-slate-100 bg-slate-50/50 rounded-2xl relative">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-indigo-650 bg-indigo-50/50 px-2 py-0.5 rounded-md">
                                                    University #{index + 1}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setFormValues(prev => ({
                                                            ...prev,
                                                            universities: (prev.universities || []).filter((_, i) => i !== index)
                                                        }));
                                                    }}
                                                    className="text-xs font-bold text-rose-500 hover:text-rose-700 transition-colors"
                                                >
                                                    Remove
                                                </button>
                                            </div>

                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-xs font-semibold text-slate-500 uppercase">Country</label>
                                                    {newCountryIndex !== index && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setNewCountryIndex(index);
                                                                setNewCountryVal("");
                                                            }}
                                                            className="text-[10px] font-bold text-indigo-650 hover:text-indigo-850 transition-colors"
                                                        >
                                                            + Add Country
                                                        </button>
                                                    )}
                                                </div>
                                                {newCountryIndex === index ? (
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            placeholder="Enter new country name"
                                                            value={newCountryVal}
                                                            onChange={e => setNewCountryVal(e.target.value)}
                                                            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-105 focus:border-indigo-500 bg-white"
                                                            onKeyDown={e => {
                                                                if (e.key === "Enter") {
                                                                    e.preventDefault();
                                                                    if (newCountryVal.trim()) addCountryMut.mutate(newCountryVal.trim());
                                                                }
                                                            }}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (newCountryVal.trim()) addCountryMut.mutate(newCountryVal.trim());
                                                            }}
                                                            disabled={addCountryMut.isPending || !newCountryVal.trim()}
                                                            className="px-3.5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 disabled:opacity-50"
                                                        >
                                                            Save
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setNewCountryIndex(null);
                                                                setNewCountryVal("");
                                                            }}
                                                            className="px-3.5 py-2 border border-slate-250 text-slate-650 rounded-xl text-xs font-bold hover:bg-slate-50"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <select
                                                        value={countries.find(c => c.name.toLowerCase() === univ.univ_country?.toLowerCase())?.name || univ.univ_country || ""}
                                                        onChange={e => {
                                                            updateUniversityField(index, "univ_country", e.target.value);
                                                            updateUniversityField(index, "univ_name", "");
                                                        }}
                                                        required
                                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-105 focus:border-indigo-500 bg-white"
                                                    >
                                                        <option value="">Select Country</option>
                                                        {countries.map(c => (
                                                            <option key={c.id} value={c.name}>{c.name}</option>
                                                        ))}
                                                    </select>
                                                )}
                                            </div>

                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-xs font-semibold text-slate-500 uppercase">University Name</label>
                                                    {newUnivIndex !== index && univ.univ_country && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setNewUnivIndex(index);
                                                                setNewUnivVal("");
                                                            }}
                                                            className="text-[10px] font-bold text-indigo-650 hover:text-indigo-855 transition-colors"
                                                        >
                                                            + Add University
                                                        </button>
                                                    )}
                                                </div>
                                                {newUnivIndex === index ? (
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            placeholder="Enter new university name"
                                                            value={newUnivVal}
                                                            onChange={e => setNewUnivVal(e.target.value)}
                                                            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-105 focus:border-indigo-500 bg-white"
                                                            onKeyDown={e => {
                                                                if (e.key === "Enter") {
                                                                    e.preventDefault();
                                                                    const countryObj = countries.find(c => c.name.toLowerCase() === univ.univ_country?.toLowerCase());
                                                                    if (newUnivVal.trim() && countryObj) {
                                                                        addUnivMut.mutate({ countryId: countryObj.id, name: newUnivVal.trim() });
                                                                    }
                                                                }
                                                            }}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const countryObj = countries.find(c => c.name.toLowerCase() === univ.univ_country?.toLowerCase());
                                                                if (newUnivVal.trim() && countryObj) {
                                                                    addUnivMut.mutate({ countryId: countryObj.id, name: newUnivVal.trim() });
                                                                }
                                                            }}
                                                            disabled={addUnivMut.isPending || !newUnivVal.trim()}
                                                            className="px-3.5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 disabled:opacity-50"
                                                        >
                                                            Save
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setNewUnivIndex(null);
                                                                setNewUnivVal("");
                                                            }}
                                                            className="px-3.5 py-2 border border-slate-250 text-slate-650 rounded-xl text-xs font-bold hover:bg-slate-50"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <select
                                                        value={(() => {
                                                            const matchedCountry = countries.find(c => c.name.toLowerCase() === univ.univ_country?.toLowerCase());
                                                            const matchedUniv = matchedCountry?.universities?.find(u => u.name.toLowerCase() === univ.univ_name?.toLowerCase());
                                                            return matchedUniv ? matchedUniv.name : (univ.univ_name || "");
                                                        })()}
                                                        onChange={e => updateUniversityField(index, "univ_name", e.target.value)}
                                                        required
                                                        disabled={!univ.univ_country}
                                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-105 focus:border-indigo-500 bg-white disabled:opacity-60"
                                                    >
                                                        <option value="">{univ.univ_country ? "Select University" : "Select Country first"}</option>
                                                        {((countries.find(c => c.name.toLowerCase() === univ.univ_country?.toLowerCase())?.universities) || []).map(u => (
                                                            <option key={u.id} value={u.name}>{u.name}</option>
                                                        ))}
                                                    </select>
                                                )}
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-semibold text-slate-500 uppercase">Course</label>
                                                <input
                                                    type="text"
                                                    required
                                                    placeholder="e.g. M.Sc. Computer Science"
                                                    value={univ.univ_course || ""}
                                                    onChange={e => updateUniversityField(index, "univ_course", e.target.value)}
                                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-semibold text-slate-500 uppercase">University Link</label>
                                                <input
                                                    type="url"
                                                    required
                                                    placeholder="e.g. https://www.utoronto.ca"
                                                    value={univ.univ_link || ""}
                                                    onChange={e => updateUniversityField(index, "univ_link", e.target.value)}
                                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                                                />
                                            </div>
                                        </div>
                                    ))}

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setFormValues(prev => ({
                                                ...prev,
                                                universities: [
                                                    ...(prev.universities || []),
                                                    { univ_country: "", univ_name: "", univ_course: "", univ_link: "" }
                                                ]
                                            }));
                                        }}
                                        className="w-full py-2.5 border border-dashed border-indigo-300 text-indigo-650 rounded-xl text-xs font-bold hover:bg-indigo-50/50 hover:border-indigo-400 transition-colors flex items-center justify-center gap-1.5 mt-2"
                                    >
                                        + Add Another University
                                    </button>
                                </div>
                            )}

                            {/* APPLICATION Process Docs & Universities */}
                            {currentStage === "APPLICATION" && (
                                <div className="space-y-6">
                                    <div className="space-y-2.5 pt-2 bg-slate-50 p-4 border border-slate-100 rounded-2xl">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Document Checklists</label>
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

                                    <div className="space-y-4">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Shortlisted Universities Status</label>
                                        {(formValues.universities || []).map((univ, index) => (
                                            <div key={index} className="space-y-4 p-4 border border-slate-100 bg-slate-50/50 rounded-2xl relative">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-bold text-indigo-650 bg-indigo-50/50 px-2 py-0.5 rounded-md">
                                                        University #{index + 1}
                                                    </span>
                                                    <div className="flex items-center gap-3">
                                                        <label className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 cursor-pointer select-none">
                                                            <input
                                                                type="checkbox"
                                                                checked={!!univ.completed}
                                                                onChange={e => updateUniversityField(index, "completed", e.target.checked)}
                                                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-250"
                                                            />
                                                            Completed
                                                        </label>
                                                        {index > 0 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setFormValues(prev => ({
                                                                        ...prev,
                                                                        universities: (prev.universities || []).filter((_, i) => i !== index)
                                                                    }));
                                                                }}
                                                                className="text-xs font-bold text-rose-500 hover:text-rose-700 transition-colors"
                                                            >
                                                                Remove
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="space-y-1.5">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-xs font-semibold text-slate-500 uppercase">Country</label>
                                                        {newCountryIndex !== index && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setNewCountryIndex(index);
                                                                    setNewCountryVal("");
                                                                }}
                                                                className="text-[10px] font-bold text-indigo-650 hover:text-indigo-850 transition-colors"
                                                            >
                                                                + Add Country
                                                            </button>
                                                        )}
                                                    </div>
                                                    {newCountryIndex === index ? (
                                                        <div className="flex gap-2">
                                                            <input
                                                                type="text"
                                                                placeholder="Enter new country name"
                                                                value={newCountryVal}
                                                                onChange={e => setNewCountryVal(e.target.value)}
                                                                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-105 focus:border-indigo-500 bg-white"
                                                                onKeyDown={e => {
                                                                    if (e.key === "Enter") {
                                                                        e.preventDefault();
                                                                        if (newCountryVal.trim()) addCountryMut.mutate(newCountryVal.trim());
                                                                    }
                                                                }}
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    if (newCountryVal.trim()) addCountryMut.mutate(newCountryVal.trim());
                                                                }}
                                                                disabled={addCountryMut.isPending || !newCountryVal.trim()}
                                                                className="px-3.5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 disabled:opacity-50"
                                                            >
                                                                Save
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setNewCountryIndex(null);
                                                                    setNewCountryVal("");
                                                                }}
                                                                className="px-3.5 py-2 border border-slate-250 text-slate-650 rounded-xl text-xs font-bold hover:bg-slate-50"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <select
                                                            value={countries.find(c => c.name.toLowerCase() === univ.univ_country?.toLowerCase())?.name || univ.univ_country || ""}
                                                            onChange={e => {
                                                                updateUniversityField(index, "univ_country", e.target.value);
                                                                updateUniversityField(index, "univ_name", "");
                                                            }}
                                                            required
                                                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-105 focus:border-indigo-500 bg-white"
                                                        >
                                                            <option value="">Select Country</option>
                                                            {countries.map(c => (
                                                                <option key={c.id} value={c.name}>{c.name}</option>
                                                            ))}
                                                        </select>
                                                    )}
                                                </div>

                                                <div className="space-y-1.5">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-xs font-semibold text-slate-500 uppercase">University Name</label>
                                                        {newUnivIndex !== index && univ.univ_country && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setNewUnivIndex(index);
                                                                    setNewUnivVal("");
                                                                }}
                                                                className="text-[10px] font-bold text-indigo-650 hover:text-indigo-855 transition-colors"
                                                            >
                                                                + Add University
                                                            </button>
                                                        )}
                                                    </div>
                                                    {newUnivIndex === index ? (
                                                        <div className="flex gap-2">
                                                            <input
                                                                type="text"
                                                                placeholder="Enter new university name"
                                                                value={newUnivVal}
                                                                onChange={e => setNewUnivVal(e.target.value)}
                                                                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-105 focus:border-indigo-500 bg-white"
                                                                onKeyDown={e => {
                                                                    if (e.key === "Enter") {
                                                                        e.preventDefault();
                                                                        const countryObj = countries.find(c => c.name.toLowerCase() === univ.univ_country?.toLowerCase());
                                                                        if (newUnivVal.trim() && countryObj) {
                                                                            addUnivMut.mutate({ countryId: countryObj.id, name: newUnivVal.trim() });
                                                                        }
                                                                    }
                                                                }}
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const countryObj = countries.find(c => c.name.toLowerCase() === univ.univ_country?.toLowerCase());
                                                                    if (newUnivVal.trim() && countryObj) {
                                                                        addUnivMut.mutate({ countryId: countryObj.id, name: newUnivVal.trim() });
                                                                    }
                                                                }}
                                                                disabled={addUnivMut.isPending || !newUnivVal.trim()}
                                                                className="px-3.5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 disabled:opacity-50"
                                                            >
                                                                Save
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setNewUnivIndex(null);
                                                                    setNewUnivVal("");
                                                                }}
                                                                className="px-3.5 py-2 border border-slate-250 text-slate-650 rounded-xl text-xs font-bold hover:bg-slate-50"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <select
                                                            value={(() => {
                                                                const matchedCountry = countries.find(c => c.name.toLowerCase() === univ.univ_country?.toLowerCase());
                                                                const matchedUniv = matchedCountry?.universities?.find(u => u.name.toLowerCase() === univ.univ_name?.toLowerCase());
                                                                return matchedUniv ? matchedUniv.name : (univ.univ_name || "");
                                                            })()}
                                                            onChange={e => updateUniversityField(index, "univ_name", e.target.value)}
                                                            required
                                                            disabled={!univ.univ_country}
                                                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-105 focus:border-indigo-500 bg-white disabled:opacity-60"
                                                        >
                                                            <option value="">{univ.univ_country ? "Select University" : "Select Country first"}</option>
                                                            {((countries.find(c => c.name.toLowerCase() === univ.univ_country?.toLowerCase())?.universities) || []).map(u => (
                                                                <option key={u.id} value={u.name}>{u.name}</option>
                                                            ))}
                                                        </select>
                                                    )}
                                                </div>

                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-semibold text-slate-500 uppercase">Course</label>
                                                    <input
                                                        type="text"
                                                        required
                                                        placeholder="e.g. M.Sc. Computer Science"
                                                        value={univ.univ_course || ""}
                                                        onChange={e => updateUniversityField(index, "univ_course", e.target.value)}
                                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                                                    />
                                                </div>

                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-semibold text-slate-500 uppercase">University Link</label>
                                                    <input
                                                        type="url"
                                                        required
                                                        placeholder="e.g. https://www.utoronto.ca"
                                                        value={univ.univ_link || ""}
                                                        onChange={e => updateUniversityField(index, "univ_link", e.target.value)}
                                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                                                    />
                                                </div>
                                            </div>
                                        ))}

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFormValues(prev => ({
                                                    ...prev,
                                                    universities: [
                                                        ...(prev.universities || []),
                                                        { univ_country: "", univ_name: "", univ_course: "", univ_link: "", completed: false }
                                                    ]
                                                }));
                                            }}
                                            className="w-full py-2.5 border border-dashed border-indigo-300 text-indigo-650 rounded-xl text-xs font-bold hover:bg-indigo-50/50 hover:border-indigo-400 transition-colors flex items-center justify-center gap-1.5 mt-2"
                                        >
                                            + Add Another University
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* AWAITING_STATUS Response */}
                            {currentStage === "AWAITING_STATUS" && (
                                <div className="space-y-4">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">University Application Responses</label>
                                    {(formValues.universities || []).map((univ, index) => (
                                        <div key={index} className="space-y-4 p-4 border border-slate-100 bg-slate-50/50 rounded-2xl relative">
                                            <div className="flex items-center justify-between">
                                                <div className="space-y-0.5">
                                                    <span className="text-xs font-bold text-indigo-650 bg-indigo-50/50 px-2 py-0.5 rounded-md block w-fit">
                                                        University #{index + 1}
                                                    </span>
                                                    <div className="text-xs text-slate-600">
                                                        <span className="font-semibold">{univ.univ_name || "Not specified"}</span>
                                                        {univ.univ_country && <span className="text-slate-400"> • {univ.univ_country}</span>}
                                                    </div>
                                                    {univ.univ_course && (
                                                        <div className="text-[10px] text-slate-500">{univ.univ_course}</div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-semibold text-slate-500 uppercase">Application Reference ID</label>
                                                <input
                                                    type="text"
                                                    required
                                                    placeholder="e.g. APP-8947-CA"
                                                    value={univ.application_ref_id || ""}
                                                    onChange={e => {
                                                        const updated = [...(formValues.universities || [])];
                                                        updated[index] = { ...updated[index], application_ref_id: e.target.value };
                                                        setFormValues({ ...formValues, universities: updated });
                                                    }}
                                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-105 focus:border-indigo-500 bg-white"
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-semibold text-slate-500 uppercase">Submission Date</label>
                                                <input
                                                    type="date"
                                                    required
                                                    value={univ.submission_date || ""}
                                                    onChange={e => {
                                                        const updated = [...(formValues.universities || [])];
                                                        updated[index] = { ...updated[index], submission_date: e.target.value };
                                                        setFormValues({ ...formValues, universities: updated });
                                                    }}
                                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-105 focus:border-indigo-500 bg-white"
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-semibold text-slate-500 uppercase">University Response</label>
                                                <select
                                                    value={univ.university_response || "Conditional Offer"}
                                                    onChange={e => {
                                                        const updated = [...(formValues.universities || [])];
                                                        updated[index] = { ...updated[index], university_response: e.target.value };
                                                        setFormValues({ ...formValues, universities: updated });
                                                    }}
                                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-105 focus:border-indigo-500 bg-white"
                                                >
                                                    <option value="Conditional Offer">Conditional Offer</option>
                                                    <option value="Unconditional Offer">Unconditional Offer</option>
                                                    <option value="Reject">Reject (Close/Archive)</option>
                                                </select>
                                            </div>
                                        </div>
                                    ))}
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

                            </div>

                            {/* Buttons */}
                            <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-3.5 mt-4">
                                <button
                                    type="button"
                                    onClick={() => setActionModal(null)}
                                    className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
                                >
                                    Cancel
                                </button>
                                {currentStage === "APPLICATION" ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={handleApplicationSave}
                                            disabled={loading}
                                            className="px-4 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 rounded-xl transition-all border border-indigo-200 flex items-center gap-1.5"
                                        >
                                            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                            Save
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition-all shadow-sm shadow-indigo-100 flex items-center gap-1.5"
                                        >
                                            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                                            Move to Awaiting Status
                                        </button>
                                    </>
                                ) : currentStage === "AWAITING_STATUS" ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={handleAwaitingStatusSave}
                                            disabled={loading}
                                            className="px-4 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 rounded-xl transition-all border border-indigo-200 flex items-center gap-1.5"
                                        >
                                            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                            Save
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition-all shadow-sm shadow-indigo-100 flex items-center gap-1.5"
                                        >
                                            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                                            Submit
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition-all shadow-sm shadow-indigo-100 flex items-center gap-1.5"
                                    >
                                        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                                        Submit
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
