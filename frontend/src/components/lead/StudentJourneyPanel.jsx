import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    Calendar, PhoneCall, CheckSquare, GraduationCap,
    FileText, Award, UploadCloud, ShieldCheck,
    CheckCircle2, AlertCircle, RefreshCw, Send, Loader2, ArrowRight, X, List, Save, Plus, Trash2, Search, Check, ChevronDown, User, MapPin, Globe, ShieldAlert, Phone, Briefcase, BookOpen, Wallet
} from "lucide-react";
import api from "../../api/axios";
import { cn } from "../../lib/utils";
import { z } from "zod";

const studentProfileSchema = z.object({
    // Step 1
    firstName: z.string().min(1, "First Name is required"),
    lastName: z.string().min(1, "Last Name is required"),
    email: z.string().email("Invalid email address"),
    mobileNumber: z.string().min(1, "Mobile Number is required"),
    dob: z.string().min(1, "Date of Birth is required"),
    gender: z.string().min(1, "Gender is required"),
    maritalStatus: z.string().min(1, "Marital Status is required"),
    mailingAddress1: z.string().min(1, "Mailing Address 1 is required"),
    mailingCountry: z.string().min(1, "Mailing Country is required"),
    mailingState: z.string().min(1, "Mailing State is required"),
    mailingCity: z.string().min(1, "Mailing City is required"),
    mailingPincode: z.string().min(1, "Mailing Pincode is required"),
    permAddressSame: z.boolean().optional(),
    permAddress1: z.string().optional(),
    permCountry: z.string().optional(),
    permState: z.string().optional(),
    permCity: z.string().optional(),
    permPincode: z.string().optional(),
    passportNumber: z.string().min(1, "Passport Number is required"),
    passportIssueDate: z.string().min(1, "Passport Issue Date is required"),
    passportExpiryDate: z.string().min(1, "Passport Expiry Date is required"),
    passportIssueCountry: z.string().min(1, "Passport Issue Country is required"),
    passportCityOfBirth: z.string().min(1, "City of Birth is required"),
    passportCountryOfBirth: z.string().min(1, "Country of Birth is required"),
    nationality: z.string().min(1, "Nationality is required"),
    citizenship: z.string().min(1, "Citizenship is required"),
    emergencyName: z.string().optional(),
    emergencyPhone: z.string().optional(),
    emergencyEmail: z.union([z.string().email("Invalid Emergency Email"), z.literal("")]).optional(),
    emergencyRelation: z.string().optional(),

    // Step 2
    countryOfEducation: z.string().min(1, "Country of Education is required"),
    highestLevelOfEducation: z.string().min(1, "Highest Level of Education is required"),

    // Step 3
    hasWorkExperience: z.boolean().optional(),
    workExperiences: z.array(z.object({
        workOrgAddress: z.string().min(1, "Organisation Name & Address is required"),
        workPosition: z.string().min(1, "Position is required"),
        workSalaryMode: z.string().optional(),
        workJobProfile: z.string().optional(),
        workFrom: z.string().min(1, "Working From date is required"),
        workCurrent: z.boolean().optional(),
        workUpto: z.string().optional(),
    }).superRefine((data, ctx) => {
        if (!data.workCurrent && (!data.workUpto || !data.workUpto.trim())) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Working Upto date is required", path: ["workUpto"] });
        }
    })).optional(),

    // Step 4
    testScores: z.object({
        GRE: z.object({ overall: z.string().min(1, "Overall Score is required"), date: z.string().optional(), quant: z.string().optional(), verbal: z.string().optional(), aw: z.string().optional() }).optional(),
        GMAT: z.object({ overall: z.string().min(1, "Overall Score is required"), date: z.string().optional(), quant: z.string().optional(), verbal: z.string().optional(), aw: z.string().optional() }).optional(),
        IELTS: z.object({ overall: z.string().min(1, "Overall Score is required"), date: z.string().optional(), quant: z.string().optional(), verbal: z.string().optional(), aw: z.string().optional() }).optional(),
        TOEFL: z.object({ overall: z.string().min(1, "Overall Score is required"), date: z.string().optional(), quant: z.string().optional(), verbal: z.string().optional(), aw: z.string().optional() }).optional(),
        PTE: z.object({ overall: z.string().min(1, "Overall Score is required"), date: z.string().optional(), quant: z.string().optional(), verbal: z.string().optional(), aw: z.string().optional() }).optional(),
        DET: z.object({ overall: z.string().min(1, "Overall Score is required"), date: z.string().optional(), quant: z.string().optional(), verbal: z.string().optional(), aw: z.string().optional() }).optional(),
        SAT: z.object({ overall: z.string().min(1, "Overall Score is required"), date: z.string().optional(), quant: z.string().optional(), verbal: z.string().optional(), aw: z.string().optional() }).optional(),
        ACT: z.object({ overall: z.string().min(1, "Overall Score is required"), date: z.string().optional(), quant: z.string().optional(), verbal: z.string().optional(), aw: z.string().optional() }).optional(),
    }).optional(),
}).superRefine((data, ctx) => {
    if (!data.permAddressSame) {
        if (!data.permAddress1) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Permanent Address 1 is required", path: ["permAddress1"] });
        if (!data.permCountry) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Permanent Country is required", path: ["permCountry"] });
        if (!data.permState) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Permanent State is required", path: ["permState"] });
        if (!data.permCity) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Permanent City is required", path: ["permCity"] });
        if (!data.permPincode) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Permanent Pincode is required", path: ["permPincode"] });
    }
});

const ALL_COUNTRIES = [
    "Afghanistan", "Albania", "Algeria", "American Samoa", "Andorra", "Angola", "Anguilla", "Antarctica", "Antigua and Barbuda", "Argentina", "Armenia", "Aruba", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bermuda", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Bouvet Island", "Brazil", "British Indian Ocean Territory", "Brunei Darussalam", "Bulgaria", "Burkina Faso", "Burundi", "Cambodia", "Cameroon", "Canada", "Cape Verde", "Cayman Islands", "Central African Republic", "Chad", "Chile", "China", "Christmas Island", "Cocos (Keeling) Islands", "Colombia", "Comoros", "Congo", "Congo, the Democratic Republic of the", "Cook Islands", "Costa Rica", "Cote D'Ivoire", "Croatia", "Cuba", "Cyprus", "Czech Republic", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Falkland Islands (Malvinas)", "Faroe Islands", "Fiji", "Finland", "France", "French Guiana", "French Polynesia", "French Southern Territories", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Gibraltar", "Greece", "Greenland", "Grenada", "Guadeloupe", "Guam", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Heard Island and Mcdonald Islands", "Holy See (Vatican City State)", "Honduras", "Hong Kong", "Hungary", "Iceland", "India", "Indonesia", "Iran, Islamic Republic of", "Iraq", "Ireland", "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Korea, Democratic People's Republic of", "Korea, Republic of", "Kosovo", "Kuwait", "Kyrgyzstan", "Lao People's Democratic Republic", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libyan Arab Jamahiriya", "Liechtenstein", "Lithuania", "Luxembourg", "Macao", "Macedonia, the Former Yugoslav Republic of", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Martinique", "Mauritania", "Mauritius", "Mayotte", "Mexico", "Micronesia, Federated States of", "Moldova, Republic of", "Monaco", "Mongolia", "Montserrat", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands", "Netherlands Antilles", "New Caledonia", "New Zealand", "Nicaragua", "Niger", "Nigeria", "Niue", "Norfolk Island", "Northern Mariana Islands", "Norway", "Oman", "Pakistan", "Palau", "Palestinian Territory, Occupied", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Pitcairn", "Poland", "Portugal", "Puerto Rico", "Qatar", "Reunion", "Romania", "Russian Federation", "Rwanda", "Saint Helena", "Saint Kitts and Nevis", "Saint Lucia", "Saint Pierre and Miquelon", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia and Montenegro", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Georgia and the South Sandwich Islands", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Svalbard and Jan Mayen", "Sweden", "Switzerland", "Syrian Arab Republic", "Taiwan, Province of China", "Tajikistan", "Tanzania, United Republic of", "Thailand", "Timor-Leste", "Togo", "Tokelau", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Turks and Caicos Islands", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "United States Minor Outlying Islands", "Uruguay", "Uzbekistan", "Vanuatu", "Venezuela", "Vietnam", "Virgin Islands, British", "Virgin Islands, U.S.", "Wallis and Futuna", "Western Sahara", "Yemen", "Zambia", "Zimbabwe"
];

function AcademicBlock({ prefix, label, setFormValues, formValues, isUG = false, isSchool = false, validationErrors = {} }) {
    const levelLabel = prefix === "pg" ? "Postgraduate" : prefix === "ug" ? "Undergraduate" : prefix === "x12" ? "Grade 12th or equivalent" : "Grade 10th or equivalent";
    const iconColor = prefix === "pg" ? "text-violet-600" : prefix === "ug" ? "text-blue-600" : prefix === "x12" ? "text-amber-600" : "text-emerald-600";
    const borderColor = prefix === "pg" ? "border-violet-100" : prefix === "ug" ? "border-blue-100" : prefix === "x12" ? "border-amber-100" : "border-emerald-100";
    const bgColor = prefix === "pg" ? "bg-violet-50/20" : prefix === "ug" ? "bg-blue-50/20" : prefix === "x12" ? "bg-amber-50/20" : "bg-emerald-50/20";
    const badgeBg = prefix === "pg" ? "bg-violet-50 text-violet-700 border-violet-200" : prefix === "ug" ? "bg-blue-50 text-blue-700 border-blue-200" : prefix === "x12" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200";

    const inputCls = "w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none font-semibold transition-all focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-white";
    const selectCls = "w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none font-semibold transition-all focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-white";
    const labelCls = "text-[10px] font-extrabold text-slate-500 uppercase tracking-wide flex items-center gap-1";

    return (
        <div className={cn("p-4 border rounded-2xl space-y-4 shadow-2xs", borderColor, bgColor)}>
            {/* Section Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                    <GraduationCap className={cn("h-4 w-4", iconColor)} />
                    <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">{label}</h4>
                </div>
                <span className={cn("text-[9px] font-extrabold px-2.5 py-0.5 rounded-full border", badgeBg)}>
                    {levelLabel}
                </span>
            </div>

            {/* Row 1: Country, State, Level */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                    <label className={labelCls}>Country of Study <span className="text-rose-500">*</span></label>
                    <select value={formValues[`${prefix}Country`] || ""} onChange={e => setFormValues(prev => ({...prev, [`${prefix}Country`]: e.target.value}))} className={selectCls}>
                        <option value="">Select Country</option>
                        {ALL_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div className="space-y-1">
                    <label className={labelCls}>State of Study <span className="text-rose-500">*</span></label>
                    <input type="text" placeholder="Enter state" value={formValues[`${prefix}State`] || ""} onChange={e => setFormValues(prev => ({...prev, [`${prefix}State`]: e.target.value}))} className={inputCls} />
                </div>
                <div className="space-y-1">
                    <label className={labelCls}>Level of Study</label>
                    <input type="text" value={formValues[`${prefix}Level`] || levelLabel} disabled className={cn(inputCls, "bg-slate-50 text-slate-500 cursor-not-allowed opacity-70")} />
                </div>
            </div>

            {/* Row 2: University/Board + Degree */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                    <label className={labelCls}>{isSchool ? "Name of Board" : "Name of University"} <span className="text-rose-500">*</span></label>
                    <input type="text" placeholder={isSchool ? "e.g. CBSE, ICSE, State Board" : "Enter university name"} value={formValues[`${prefix}University`] || ""} onChange={e => setFormValues(prev => ({...prev, [`${prefix}University`]: e.target.value}))} className={inputCls} />
                </div>
                <div className="space-y-1">
                    <label className={labelCls}>Qualification / Degree Awarded</label>
                    <input type="text" placeholder="e.g. B.Tech, MBA, HSC" value={formValues[`${prefix}Degree`] || ""} onChange={e => setFormValues(prev => ({...prev, [`${prefix}Degree`]: e.target.value}))} className={inputCls} />
                </div>
            </div>

            {/* Institution (School only) */}
            {isSchool && (
                <div className="space-y-1">
                    <label className={labelCls}>Name of the Institution <span className="text-rose-500">*</span></label>
                    <input type="text" placeholder="Enter school / institution name" value={formValues[`${prefix}Institution`] || ""} onChange={e => setFormValues(prev => ({...prev, [`${prefix}Institution`]: e.target.value}))} className={inputCls} />
                </div>
            )}

            {/* Row 3: City, Grading, Score */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                    <label className={labelCls}>City of Study <span className="text-rose-500">*</span></label>
                    <input type="text" placeholder="Enter city" value={formValues[`${prefix}City`] || ""} onChange={e => setFormValues(prev => ({...prev, [`${prefix}City`]: e.target.value}))} className={inputCls} />
                </div>
                <div className="space-y-1">
                    <label className={labelCls}>Grading System <span className="text-rose-500">*</span></label>
                    <select value={formValues[`${prefix}Grading`] || ""} onChange={e => setFormValues(prev => ({...prev, [`${prefix}Grading`]: e.target.value}))} className={selectCls}>
                        <option value="">Select Grading</option>
                        <option value="CGPA / 10">CGPA / 10</option>
                        <option value="GPA / 4">GPA / 4</option>
                        <option value="Percentage">Percentage</option>
                        <option value="Grade (A-F)">Grade (A-F)</option>
                    </select>
                </div>
                <div className="space-y-1">
                    <label className={labelCls}>
                        {prefix === "pg" ? "Percentage" : `Score (${label.split(" ")[0]})`} <span className="text-rose-500">*</span>
                    </label>
                    <input type="text" placeholder="Enter score" value={formValues[`${prefix}Score`] || formValues[`${prefix}Percentage`] || ""} onChange={e => {
                        const val = e.target.value;
                        if (prefix === "pg") {
                            setFormValues(prev => ({...prev, pgPercentage: val, pgScore: val}));
                        } else {
                            setFormValues(prev => ({...prev, [`${prefix}Score`]: val}));
                        }
                    }} className={inputCls} />
                </div>
            </div>

            {/* Row 4: Language, Backlogs (UG only), Dates */}
            <div className={cn("grid gap-3", isUG ? "grid-cols-1 md:grid-cols-4" : "grid-cols-1 md:grid-cols-3")}>
                <div className="space-y-1">
                    <label className={labelCls}>Language of Instruction <span className="text-rose-500">*</span></label>
                    <input type="text" placeholder="e.g. English" value={formValues[`${prefix}Language`] || ""} onChange={e => setFormValues(prev => ({...prev, [`${prefix}Language`]: e.target.value}))} className={inputCls} />
                </div>
                {isUG && (
                    <div className="space-y-1">
                        <label className={labelCls}>Backlogs</label>
                        <input type="number" min="0" placeholder="0" value={formValues.ugBacklogs !== undefined ? formValues.ugBacklogs : (formValues.backlogs || 0)} onChange={e => setFormValues(prev => ({...prev, ugBacklogs: e.target.value, backlogs: e.target.value}))} className={inputCls} />
                    </div>
                )}
                <div className="space-y-1">
                    <label className={labelCls}>Start Date <span className="text-rose-500">*</span></label>
                    <input type="date" value={formValues[`${prefix}StartDate`] || ""} onChange={e => setFormValues(prev => ({...prev, [`${prefix}StartDate`]: e.target.value}))} className={inputCls} />
                </div>
                <div className="space-y-1">
                    <label className={labelCls}>End Date <span className="text-rose-500">*</span></label>
                    <input
                        type="date"
                        min={formValues[`${prefix}StartDate`] || undefined}
                        value={formValues[`${prefix}EndDate`] || ""}
                        onChange={e => setFormValues(prev => ({...prev, [`${prefix}EndDate`]: e.target.value}))}
                        className={cn(inputCls, validationErrors[`${prefix}EndDate`] && "border-rose-400 focus:ring-rose-100 focus:border-rose-400 bg-rose-50/10")}
                    />
                    {validationErrors[`${prefix}EndDate`] && (
                        <p className="text-[10px] text-rose-550 font-bold mt-1 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3 shrink-0" />
                            {validationErrors[`${prefix}EndDate`]}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

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
    "deposit_amount",
    "payment_mode",
    "payment_date",
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
    const [customPaymentMode, setCustomPaymentMode] = useState("");
    const DEPOSIT_BUILT_IN_MODES = ["Bank Transfer", "Credit Card", "Debit Card", "UPI", "Cash", "Cheque"];
    const [prospectStep, setProspectStep] = useState(1);
    const [activeTests, setActiveTests] = useState([]);
    const [uploadingProof, setUploadingProof] = useState(false);
    const [validationErrors, setValidationErrors] = useState({});
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);
    // Per-university inline deposit form state
    const [univDepositModal, setUnivDepositModal] = useState(null); // { univName, amount, mode, date, customMode, saving }

    const renderTestField = (testName, fieldKey, label, type = "text", required = false) => {
        const name = `testScores.${testName}.${fieldKey}`;
        const hasError = !!validationErrors[name];
        const value = formValues.testScores?.[testName]?.[fieldKey] ?? "";
        
        const onChange = (e) => {
            const val = e.target.value;
            setFormValues(prev => {
                const updatedScores = { ...prev.testScores };
                updatedScores[testName] = { ...updatedScores[testName], [fieldKey]: val };
                return { ...prev, testScores: updatedScores };
            });
        };

        return (
            <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                    {label} {required && <span className="text-rose-500 font-bold">*</span>}
                </label>
                <input
                    type={type}
                    value={value}
                    onChange={onChange}
                    className={cn(
                        "w-full px-3 py-2 text-xs border rounded-xl outline-none font-semibold transition-all focus:ring-2 focus:ring-indigo-100 bg-white",
                        hasError ? "border-rose-400 focus:ring-rose-100 focus:border-rose-400 bg-rose-50/10" : "border-slate-200 focus:border-indigo-500"
                    )}
                />
                {hasError && (
                    <p className="text-[10px] text-rose-550 font-bold mt-1 animate-fadeIn flex items-center gap-1">
                        <AlertCircle className="h-3 w-3 text-rose-555 shrink-0" />
                        {validationErrors[name]}
                    </p>
                )}
            </div>
        );
    };

    const renderField = (name, label, type = "text", required = false, options = []) => {
        const hasError = !!validationErrors[name];
        
        let value = "";
        if (name.includes(".")) {
            const parts = name.split(".");
            value = formValues[parts[0]]?.[parseInt(parts[1], 10)]?.[parts[2]] ?? "";
        } else {
            value = formValues[name] ?? "";
        }

        const onChange = (e) => {
            const val = e.target.value;
            setFormValues(prev => {
                if (name.includes(".")) {
                    const parts = name.split(".");
                    const arrayName = parts[0];
                    const idx = parseInt(parts[1], 10);
                    const fieldName = parts[2];
                    
                    const newArray = [...(prev[arrayName] || [])];
                    newArray[idx] = { ...newArray[idx], [fieldName]: val };
                    return { ...prev, [arrayName]: newArray };
                }
                return { ...prev, [name]: val };
            });
        };

        return (
            <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                    {label} {required && <span className="text-rose-500 font-bold">*</span>}
                </label>
                {type === "select" ? (
                    <select
                        value={value}
                        onChange={onChange}
                        className={cn(
                            "w-full px-3 py-2 text-xs border rounded-xl outline-none bg-white font-semibold transition-all focus:ring-2 focus:ring-indigo-100",
                            hasError ? "border-rose-400 focus:ring-rose-100 focus:border-rose-400 bg-rose-50/10" : "border-slate-200 focus:border-indigo-500"
                        )}
                    >
                        <option value="">Select {label}</option>
                        {options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                ) : (
                    <input
                        type={type}
                        value={value}
                        onChange={onChange}
                        className={cn(
                            "w-full px-3 py-2 text-xs border rounded-xl outline-none font-semibold transition-all focus:ring-2 focus:ring-indigo-100 bg-white",
                            hasError ? "border-rose-400 focus:ring-rose-100 focus:border-rose-400 bg-rose-50/10" : "border-slate-200 focus:border-indigo-500"
                        )}
                    />
                )}
                {hasError && (
                    <p className="text-[10px] text-rose-550 font-bold mt-1 animate-fadeIn flex items-center gap-1">
                        <AlertCircle className="h-3 w-3 text-rose-555 shrink-0" />
                        {validationErrors[name]}
                    </p>
                )}
            </div>
        );
    };

    const validateAllWithZod = () => {
        // ── Custom business-rule checks (dates, passport validity, score ranges) ──
        const customErrors = {};

        // Passport must remain valid for at least the next 6 months.
        if (formValues.passportExpiryDate) {
            const expiry = new Date(formValues.passportExpiryDate);
            const sixMonthsOut = new Date();
            sixMonthsOut.setMonth(sixMonthsOut.getMonth() + 6);
            if (!isNaN(expiry.getTime()) && expiry < sixMonthsOut) {
                customErrors.passportExpiryDate = "Passport must be valid for at least the next 6 months";
            }
        }

        // Academic end date cannot be earlier than its start date.
        ["pg", "ug", "x12", "x10"].forEach(p => {
            const start = formValues[`${p}StartDate`];
            const end = formValues[`${p}EndDate`];
            if (start && end && new Date(end) < new Date(start)) {
                customErrors[`${p}EndDate`] = "End date cannot be earlier than the start date";
            }
        });

        // Analytical Writing (GRE/GMAT) is scored out of 6.
        ["GRE", "GMAT"].forEach(t => {
            const aw = formValues.testScores?.[t]?.aw;
            if (aw !== undefined && String(aw).trim() !== "") {
                const n = Number(aw);
                if (isNaN(n) || n < 0 || n > 6) {
                    customErrors[`testScores.${t}.aw`] = "Analytical Writing score must be between 0 and 6";
                }
            }
        });

        if (Object.keys(customErrors).length > 0) {
            setValidationErrors(customErrors);
            const keys = Object.keys(customErrors);
            const firstMsg = customErrors[keys[0]];
            if (keys.includes("passportExpiryDate")) setProspectStep(1);
            else if (keys.some(k => k.startsWith("testScores"))) setProspectStep(4);
            else setProspectStep(2);
            toast.error(firstMsg);
            return false;
        }

        // Clean up testScores: only validate tests that are currently active/expanded
        const cleanedScores = {};
        activeTests.forEach(testName => {
            if (formValues.testScores?.[testName]) {
                cleanedScores[testName] = formValues.testScores[testName];
            } else {
                cleanedScores[testName] = { overall: "", quant: "", verbal: "", aw: "" };
            }
        });
        
        const valuesToValidate = {
            ...formValues,
            testScores: Object.keys(cleanedScores).length > 0 ? cleanedScores : undefined
        };

        const result = studentProfileSchema.safeParse(valuesToValidate);
        if (!result.success) {
            const errors = {};
            result.error.issues.forEach(issue => {
                const path = issue.path.join(".");
                errors[path] = issue.message;
            });
            setValidationErrors(errors);

            const step1Fields = [
                "firstName", "lastName", "email", "mobileNumber", "dob", "gender", "maritalStatus",
                "mailingAddress1", "mailingCountry", "mailingState", "mailingCity", "mailingPincode",
                "permAddress1", "permCountry", "permState", "permCity", "permPincode",
                "passportNumber", "passportIssueDate", "passportExpiryDate", "passportIssueCountry", "passportCityOfBirth", "passportCountryOfBirth",
                "nationality", "citizenship", "emergencyName", "emergencyPhone", "emergencyEmail", "emergencyRelation"
            ];
            const step2Fields = [
                "countryOfEducation", "highestLevelOfEducation"
            ];

            let hasStep1Error = false;
            let hasStep2Error = false;
            let hasStep3Error = false;
            let hasStep4Error = false;

            Object.keys(errors).forEach(key => {
                if (step1Fields.includes(key)) hasStep1Error = true;
                else if (step2Fields.includes(key)) hasStep2Error = true;
                else if (key.startsWith("workExperiences")) hasStep3Error = true;
                else if (key.startsWith("testScores")) hasStep4Error = true;
            });

            const errorMsgs = Object.values(errors).slice(0, 2).join(", ");

            if (hasStep1Error) {
                toast.error(`Please fix Step 1 (Personal Details): ${errorMsgs}`);
                setProspectStep(1);
            } else if (hasStep2Error) {
                toast.error(`Please fix Step 2 (Academic Details): ${errorMsgs}`);
                setProspectStep(2);
            } else if (hasStep3Error) {
                toast.error(`Please fix Step 3 (Work Experience): ${errorMsgs}`);
                setProspectStep(3);
            } else if (hasStep4Error) {
                toast.error(`Please fix Step 4 (Test Scores): ${errorMsgs}`);
                setProspectStep(4);
            } else {
                toast.error(`Validation errors: ${errorMsgs}`);
            }

            return false;
        }
        setValidationErrors({});
        return true;
    };

    const [newCountryIndex, setNewCountryIndex] = useState(null);
    const [newCountryVal, setNewCountryVal] = useState("");
    const [newUnivIndex, setNewUnivIndex] = useState(null);
    const [newUnivVal, setNewUnivVal] = useState("");
    const [newPortalIndex, setNewPortalIndex] = useState(null);
    const [newPortalVal, setNewPortalVal] = useState("");

    const salesDept = lead.leadDepartments?.find(ld => ld.department === "SALES");
    if (!salesDept) return null;

    const currentStage = salesDept.stage;
    const customFields = lead.customFields || {};

    const { data: countries = [], refetch: refetchCountries } = useQuery({
        queryKey: ["countries-list"],
        queryFn: () => api.get("/countries").then(r => r.data),
        enabled: currentStage === "UNIVERSITY_SHORTLISTING" || currentStage === "APPLICATION",
    });

    const { data: portals = [], refetch: refetchPortals } = useQuery({
        queryKey: ["third-party-portals-list"],
        queryFn: () => api.get("/third-party-portals").then(r => r.data),
        enabled: currentStage === "APPLICATION",
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
            toast.error(e.response?.data?.error?.message || e.response?.data?.message || "Failed to add country");
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
            toast.error(e.response?.data?.error?.message || e.response?.data?.message || "Failed to add university");
        }
    });

    const addPortalMut = useMutation({
        mutationFn: (name) => api.post("/third-party-portals", { name }).then(r => r.data),
        onSuccess: (newPortal) => {
            refetchPortals();
            if (newPortalIndex !== null) {
                updateUniversityField(newPortalIndex, "univ_portal", newPortal.name);
            }
            setNewPortalIndex(null);
            setNewPortalVal("");
            toast.success("Third party option added successfully");
        },
        onError: (e) => {
            toast.error(e.response?.data?.error?.message || e.response?.data?.message || "Failed to add third party option");
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
            requiredFields: ["Visa Appointment Date", "Mock Interview Scorecard", "Copy of Approved Visa Passport Page", "Flight Departure Date"],
            instruction: "Set embassy response: Approved (advances to Visa Approval) or Refused (archives)."
        },
        VISA_APPROVAL: {
            title: "Visa Approval",
            color: "text-emerald-600 bg-emerald-50 border-emerald-200",
            icon: CheckCircle2,
            buttonText: "View / Raise Invoice",
            requiredFields: [],
            instruction: "Awaiting commission invoice payment — lead auto-advances to Commission Invoicing once fully paid."
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

    // Profile-editor mode: lets the Student Profile be viewed/edited from any stage,
    // not just PROSPECT.
    const isProfileMode = actionModal === "profile";
    const hasProfile = !!customFields.firstName || !!customFields.lastName;

    // Closing the multi-step profile form loses unsaved input, so confirm first.
    const attemptCloseModal = () => {
        if (isProfileMode || currentStage === "PROSPECT") {
            setShowCloseConfirm(true);
        } else {
            setActionModal(null);
        }
    };
    const confirmCloseModal = () => {
        setShowCloseConfirm(false);
        setActionModal(null);
    };

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
    // Uploads the visa-approval proof; it then appears in the lead's Documents list.
    const handleVisaProofUpload = async (file) => {
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            toast.error("File size exceeds 10MB limit");
            return;
        }
        const fd = new FormData();
        fd.append("document", file);
        fd.append("documentName", "Proof of Visa Approved");
        setUploadingProof(true);
        try {
            await api.post(`/upload/document/${lead.id}`, fd, { headers: { "Content-Type": "multipart/form-data" } });
            toast.success("Proof of Visa Approved uploaded");
            onChanged();
        } catch (err) {
            toast.error(err.response?.data?.error?.message || err.response?.data?.message || "Failed to upload proof");
        } finally {
            setUploadingProof(false);
        }
    };

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
            else if (currentStage === "PROSPECT" || isProfileMode) {
                if (!validateAllWithZod()) {
                    setLoading(false);
                    return;
                }
                
                const payload = { ...formValues };
                // Clean up testScores: only save tests that are currently active/expanded
                const cleanedScores = {};
                activeTests.forEach(testName => {
                    if (payload.testScores?.[testName]) {
                        cleanedScores[testName] = payload.testScores[testName];
                    }
                });
                payload.testScores = cleanedScores;

                // Synchronize legacy keys for compatibility
                payload.ielts_toefl_score = formValues.testOverall || formValues.ugScore || "";
                payload.academic_gpa = formValues.ugScore || "";
                payload.backlogs = parseInt(formValues.ugBacklogs || formValues.backlogs, 10) || 0;

                await saveCustomFieldsMut.mutateAsync(payload);
                toast.success("Student profile saved successfully");
                onChanged();
                setActionModal(null);
            }
            else if (currentStage === "UNIVERSITY_SHORTLISTING") {
                const rawList = formValues.universities || [];

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
                const prevHistory = Array.isArray(customFields.deposit_history) ? customFields.deposit_history : [];
                // Resolve custom sentinel to the actual typed value
                const resolvedPaymentMode = formValues.payment_mode === "__custom__"
                    ? customPaymentMode.trim()
                    : (formValues.payment_mode || "");
                const selectedCollege = formValues.deposit_college || "";
                const historyEntry = {
                    deposit_amount: formValues.deposit_amount || "",
                    payment_mode: resolvedPaymentMode,
                    payment_date: formValues.payment_date || "",
                    deposit_college: selectedCollege,
                    recordedAt: new Date().toISOString(),
                };
                await saveCustomFieldsMut.mutateAsync({
                    deposit_amount: formValues.deposit_amount || "",
                    payment_mode: resolvedPaymentMode,
                    payment_date: formValues.payment_date || "",
                    deposit_college: selectedCollege,
                    deposit_history: [historyEntry, ...prevHistory]
                });
                // Surface the payment details on the lead's activity timeline.
                const paidOn = formValues.payment_date
                    ? new Date(formValues.payment_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                    : "—";
                const collegeNote = selectedCollege ? ` · College: ${selectedCollege}` : "";
                await api.post(`/leads/${lead.id}/notes`, {
                    content: `💰 Deposit recorded — Amount: ${formValues.deposit_amount || "—"} · Mode: ${resolvedPaymentMode || "—"} · Date: ${paidOn}${collegeNote}`
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
                    visa_manager_approved: !!formValues.visa_manager_approved,
                    visa_appointment_date: formValues.visa_appointment_date || null
                });
                toast.success("Visa documentation details saved");
                onChanged();
                setActionModal(null);
            }
            else if (currentStage === "VISA_STATUS") {
                await saveCustomFieldsMut.mutateAsync({
                    visa_appointment_date: formValues.visa_appointment_date || null,
                    mock_interview_scorecard: formValues.mock_interview_scorecard || "",
                    embassy_result: formValues.embassy_result,
                    visa_approved_date: formValues.visa_approved_date || null,
                    approved_visa_passport: formValues.approved_visa_passport || "",
                    flight_departure_date: formValues.flight_departure_date || null
                });
                toast.success(`Embassy result updated to ${formValues.embassy_result}`);
                onChanged();
                setActionModal(null);
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
        if (currentStage === "ENQUIRY" && modalName !== "profile") {
            setFormValues({ noteContent: "" });
        }
        else if (currentStage === "FOLLOW_UP" && modalName !== "profile") {
            setFormValues({ nextFollowUpAt: lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt).toISOString().slice(0, 16) : "" });
        }
        else if (currentStage === "PROSPECT" || modalName === "profile") {
            // Prefill basic info captured at lead creation (name / email / phone)
            // when the profile fields haven't been filled yet.
            const nameParts = (lead.name || "").trim().split(/\s+/).filter(Boolean);
            const leadFirstName = nameParts[0] || "";
            const leadLastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
            // Split a stored phone like "+91 98765..." into code + number where possible.
            const rawPhone = (lead.phone || "").trim();
            const phoneMatch = rawPhone.match(/^(\+\d{1,3})[\s-]?(.*)$/);
            const leadPhoneCode = phoneMatch ? phoneMatch[1] : "";
            const leadPhoneNumber = phoneMatch ? phoneMatch[2].replace(/\s+/g, "") : rawPhone;

            setFormValues({
                // Step 1: Personal Details
                firstName: customFields.firstName || leadFirstName,
                middleName: customFields.middleName || "",
                lastName: customFields.lastName || leadLastName,
                email: customFields.email || lead.email || "",
                mobileCountryCode: customFields.mobileCountryCode || leadPhoneCode || "+91",
                mobileNumber: customFields.mobileNumber || leadPhoneNumber || "",
                dob: customFields.dob || "",
                gender: customFields.gender || "",
                maritalStatus: customFields.maritalStatus || "",
                // Mailing Address
                mailingAddress1: customFields.mailingAddress1 || "",
                mailingAddress2: customFields.mailingAddress2 || "",
                mailingCountry: customFields.mailingCountry || "",
                mailingState: customFields.mailingState || "",
                mailingCity: customFields.mailingCity || "",
                mailingPincode: customFields.mailingPincode || "",
                // Permanent Address
                permAddressSame: customFields.permAddressSame !== undefined ? customFields.permAddressSame : false,
                permAddress1: customFields.permAddress1 || "",
                permAddress2: customFields.permAddress2 || "",
                permCountry: customFields.permCountry || "",
                permState: customFields.permState || "",
                permCity: customFields.permCity || "",
                permPincode: customFields.permPincode || "",
                // Passport Information
                passportNumber: customFields.passportNumber || "",
                passportIssueDate: customFields.passportIssueDate || "",
                passportExpiryDate: customFields.passportExpiryDate || "",
                passportIssueCountry: customFields.passportIssueCountry || "",
                passportCityOfBirth: customFields.passportCityOfBirth || "",
                passportCountryOfBirth: customFields.passportCountryOfBirth || "",
                // Nationality
                nationality: customFields.nationality || "",
                citizenship: customFields.citizenship || "",
                dualCitizenship: customFields.dualCitizenship !== undefined ? customFields.dualCitizenship : "No",
                dualCitizenshipCountries: customFields.dualCitizenshipCountries || "",
                otherCountryStudy: customFields.otherCountryStudy !== undefined ? customFields.otherCountryStudy : "No",
                otherCountryStudyName: customFields.otherCountryStudyName || "",
                // Background Info
                appliedImmigration: customFields.appliedImmigration !== undefined ? customFields.appliedImmigration : "No",
                appliedImmigrationCountry: customFields.appliedImmigrationCountry || "",
                medicalCondition: customFields.medicalCondition !== undefined ? customFields.medicalCondition : "No",
                medicalConditionDetails: customFields.medicalConditionDetails || "",
                visaRefusal: customFields.visaRefusal !== undefined ? customFields.visaRefusal : "No",
                visaRefusalCountry: customFields.visaRefusalCountry || "",
                visaRefusalType: customFields.visaRefusalType || "",
                criminalConviction: customFields.criminalConviction !== undefined ? customFields.criminalConviction : "No",
                criminalConvictionDetails: customFields.criminalConvictionDetails || "",
                // Emergency Contact
                emergencyName: customFields.emergencyName || "",
                emergencyPhoneCountryCode: customFields.emergencyPhoneCountryCode || "+91",
                emergencyPhone: customFields.emergencyPhone || "",
                emergencyEmail: customFields.emergencyEmail || "",
                emergencyRelation: customFields.emergencyRelation || "",

                // Step 2: Academic Details
                countryOfEducation: customFields.countryOfEducation || "",
                highestLevelOfEducation: customFields.highestLevelOfEducation || "",
                // PG
                pgCountry: customFields.pgCountry || "",
                pgState: customFields.pgState || "",
                pgLevel: customFields.pgLevel || "Postgraduate",
                pgUniversity: customFields.pgUniversity || "",
                pgDegree: customFields.pgDegree || "",
                pgCity: customFields.pgCity || "",
                pgGrading: customFields.pgGrading || "",
                pgPercentage: customFields.pgPercentage || "",
                pgLanguage: customFields.pgLanguage || "",
                pgStartDate: customFields.pgStartDate || "",
                pgEndDate: customFields.pgEndDate || "",
                // UG
                ugCountry: customFields.ugCountry || "",
                ugState: customFields.ugState || "",
                ugLevel: customFields.ugLevel || "Undergraduate",
                ugUniversity: customFields.ugUniversity || "",
                ugDegree: customFields.ugDegree || "",
                ugCity: customFields.ugCity || "",
                ugGrading: customFields.ugGrading || "",
                ugScore: customFields.ugScore || "",
                ugLanguage: customFields.ugLanguage || "",
                ugBacklogs: customFields.ugBacklogs || "",
                ugStartDate: customFields.ugStartDate || "",
                ugEndDate: customFields.ugEndDate || "",
                // 12th
                x12Country: customFields.x12Country || "",
                x12State: customFields.x12State || "",
                x12Level: customFields.x12Level || "Grade 12th or equivalent",
                x12Board: customFields.x12Board || "",
                x12Degree: customFields.x12Degree || "",
                x12Institution: customFields.x12Institution || "",
                x12City: customFields.x12City || "",
                x12Grading: customFields.x12Grading || "",
                x12Score: customFields.x12Score || "",
                x12Language: customFields.x12Language || "",
                x12StartDate: customFields.x12StartDate || "",
                x12EndDate: customFields.x12EndDate || "",
                // 10th
                x10Country: customFields.x10Country || "",
                x10State: customFields.x10State || "",
                x10Level: customFields.x10Level || "Grade 10th or equivalent",
                x10Board: customFields.x10Board || "",
                x10Degree: customFields.x10Degree || "",
                x10Institution: customFields.x10Institution || "",
                x10City: customFields.x10City || "",
                x10Grading: customFields.x10Grading || "",
                x10Score: customFields.x10Score || "",
                x10Language: customFields.x10Language || "",
                x10StartDate: customFields.x10StartDate || "",
                x10EndDate: customFields.x10EndDate || "",

                // Step 3: Work Experience
                hasWorkExperience: customFields.hasWorkExperience !== undefined ? customFields.hasWorkExperience : false,
                workExperiences: Array.isArray(customFields.workExperiences) 
                    ? customFields.workExperiences 
                    : (customFields.workOrgAddress 
                        ? [{ 
                            workOrgAddress: customFields.workOrgAddress, 
                            workPosition: customFields.workPosition, 
                            workJobProfile: customFields.workJobProfile, 
                            workSalaryMode: customFields.workSalaryMode, 
                            workFrom: customFields.workFrom, 
                            workUpto: customFields.workUpto, 
                            workCurrent: customFields.workCurrent !== undefined ? customFields.workCurrent : false
                          }] 
                        : []),

                // Step 4: Tests
                testScores: customFields.testScores || {},
            });
            setActiveTests(Object.keys(customFields.testScores || {}));
            setProspectStep(1);
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
                universities: existingShortlist
            });
        }
        else if (currentStage === "AWAITING_STATUS") {
            const existingShortlist = Array.isArray(customFields.shortlisted_universities)
                ? customFields.shortlisted_universities.map(univ => ({
                    ...univ,
                    application_ref_id: univ.application_ref_id || "",
                    submission_date: univ.submission_date ? new Date(univ.submission_date).toISOString().split("T")[0] : "",
                    university_response: univ.university_response || "Conditional Offer",
                    confirmed: !!univ.confirmed
                }))
                : [];
            setFormValues({
                universities: existingShortlist
            });
        }
        else if (currentStage === "DEPOSIT_STATUS") {
            setFormValues({
                deposit_amount: customFields.deposit_amount || "",
                payment_mode: customFields.payment_mode || "",
                payment_date: customFields.payment_date || "",
                deposit_college: customFields.deposit_college || ""
            });
        }
        else if (currentStage === "VISA_DOCUMENTATION") {
            setFormValues({
                financial_proof_docs: customFields.financial_proof_docs || "",
                cas_form_number: customFields.cas_form_number || "",
                visa_manager_approved: customFields.visa_manager_approved === true || customFields.visa_manager_approved === "true",
                visa_appointment_date: customFields.visa_appointment_date ? new Date(customFields.visa_appointment_date).toISOString().split("T")[0] : ""
            });
        }
        else if (currentStage === "VISA_STATUS") {
            setFormValues({
                visa_appointment_date: customFields.visa_appointment_date ? new Date(customFields.visa_appointment_date).toISOString().split("T")[0] : "",
                mock_interview_scorecard: customFields.mock_interview_scorecard || "",
                embassy_result: customFields.embassy_result || "Approved",
                visa_approved_date: customFields.visa_approved_date ? new Date(customFields.visa_approved_date).toISOString().split("T")[0] : "",
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

                {hasProfile && (
                    <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 space-y-3 shadow-2xs relative">
                        <div className="flex items-center justify-between border-b border-slate-150 pb-2">
                            <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-indigo-650" />
                                <h4 className="text-xs font-extrabold text-slate-750 uppercase tracking-wider">Student Profile</h4>
                            </div>
                            <button
                                type="button"
                                onClick={() => initModal("profile")}
                                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-white hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl transition-all shadow-3xs flex items-center gap-1 cursor-pointer"
                            >
                                Edit Profile
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] font-medium text-slate-650">
                            <div>
                                <span className="text-[9px] font-extrabold text-slate-400 uppercase block tracking-wider">Full Name</span>
                                <span className="font-bold text-slate-800">{customFields.firstName} {customFields.middleName ? customFields.middleName + " " : ""}{customFields.lastName}</span>
                            </div>
                            <div>
                                <span className="text-[9px] font-extrabold text-slate-400 uppercase block tracking-wider">Email Address</span>
                                <span className="font-bold text-slate-800 truncate block">{customFields.email || "N/A"}</span>
                            </div>
                            <div>
                                <span className="text-[9px] font-extrabold text-slate-400 uppercase block tracking-wider">Highest Education</span>
                                <span className="font-bold text-slate-800">{customFields.highestLevelOfEducation || "N/A"}</span>
                            </div>
                            <div>
                                <span className="text-[9px] font-extrabold text-slate-400 uppercase block tracking-wider">Work Experience</span>
                                <span className="font-bold text-slate-800">
                                    {customFields.hasWorkExperience 
                                        ? `${Array.isArray(customFields.workExperiences) ? customFields.workExperiences.length : 1} Job(s)` 
                                        : "No Experience"}
                                </span>
                            </div>
                        </div>

                        {customFields.testScores && Object.keys(customFields.testScores).length > 0 && (
                            <div className="pt-2 border-t border-slate-100">
                                <span className="text-[9px] font-extrabold text-slate-400 uppercase block tracking-wider mb-1.5">Test Scores</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {Object.entries(customFields.testScores).map(([testName, scores]) => (
                                        <span key={testName} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white text-indigo-700 border border-indigo-150 shadow-3xs">
                                            <Award className="h-3 w-3 text-indigo-500" /> {testName}: {scores.overall}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Primary stage action button (profile card carries its own Edit) */}
                {currentStage === "PROSPECT"
                    ? (!hasProfile && (
                        <button
                            onClick={() => initModal("profile")}
                            className="w-full inline-flex items-center justify-center gap-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl py-2.5 transition-all shadow-sm shadow-indigo-100 hover:scale-[1.01] cursor-pointer"
                        >
                            Create Student Profile
                            <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                    ))
                    : currentStage === "VISA_APPROVAL" ? (
                        <button
                            onClick={() => navigate(`/invoices?leadId=${lead.id}`)}
                            className="w-full inline-flex items-center justify-center gap-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl py-2.5 transition-all shadow-sm shadow-indigo-100 hover:scale-[1.01] cursor-pointer"
                        >
                            {config.buttonText}
                            <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                    ) : (
                        <button
                            onClick={() => initModal("standard")}
                            className="w-full inline-flex items-center justify-center gap-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl py-2.5 transition-all shadow-sm shadow-indigo-100 hover:scale-[1.01] cursor-pointer"
                        >
                            {config.buttonText}
                            <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                    )
                }
            </div>

            {/* Stage Actions Modal */}
            {actionModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
                    onClick={attemptCloseModal}
                >
                    <div
                        className={`relative bg-white rounded-2xl shadow-2xl w-full flex flex-col p-6 animate-in fade-in zoom-in duration-200 ${(currentStage === "PROSPECT" || isProfileMode) ? "max-w-4xl" : "max-w-md"}`}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                            <h3 className="text-base font-bold text-slate-800">
                                {isProfileMode ? (hasProfile ? "Edit Student Profile" : "Create Student Profile")
                                    : currentStage === "FOLLOW_UP" && actionModal === "interested" ? "Mark Lead as Interested"
                                    : config.buttonText}
                            </h3>
                            <button
                                onClick={attemptCloseModal}
                                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handleActionSubmit} noValidate className="flex flex-col flex-1 min-h-0">
                            <div className="flex-1 overflow-y-auto max-h-[60vh] pr-1.5 space-y-4">
                            {/* ENQUIRY Note */}
                            {currentStage === "ENQUIRY" && !isProfileMode && (
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
                            {currentStage === "FOLLOW_UP" && !isProfileMode && (
                                <p className="text-sm text-slate-500 font-medium leading-relaxed">
                                    Are you sure you want to move this lead to the <span className="font-semibold text-blue-600">Prospect</span> stage? This confirms that you have received the student's resume.
                                </p>
                            )}

                            {/* PROSPECT 4-Step Form */}
                            {(currentStage === "PROSPECT" || isProfileMode) && (
                                <div className="space-y-5">
                                    {/* Step Indicators */}
                                    <div className="flex items-center justify-between border-b border-slate-150 pb-4">
                                        {[
                                            { step: 1, label: "Personal" },
                                            { step: 2, label: "Academic" },
                                            { step: 3, label: "Experience" },
                                            { step: 4, label: "Tests" }
                                        ].map(({ step, label }) => (
                                            <button 
                                                type="button" 
                                                key={step} 
                                                onClick={() => setProspectStep(step)}
                                                className="flex items-center gap-2 cursor-pointer focus:outline-none group"
                                            >
                                                <span className={cn(
                                                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all group-hover:scale-105",
                                                    prospectStep === step
                                                        ? "bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-100"
                                                        : prospectStep > step
                                                        ? "bg-emerald-500 text-white"
                                                        : "bg-slate-100 text-slate-400"
                                                )}>
                                                    {step}
                                                </span>
                                                <span className={cn(
                                                    "text-xs font-bold hidden sm:inline transition-colors",
                                                    prospectStep === step
                                                        ? "text-indigo-950"
                                                        : prospectStep > step
                                                        ? "text-emerald-650"
                                                        : "text-slate-400 group-hover:text-slate-650"
                                                )}>
                                                    {label}
                                                </span>
                                            </button>
                                        ))}
                                    </div>

                                    {/* Step 1: Personal Details */}
                                    {prospectStep === 1 && (
                                        <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-2">
                                            {/* Personal Information */}
                                            <div className="p-4 border border-slate-100 bg-slate-50/50 rounded-2xl space-y-4 shadow-2xs">
                                                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                                                    <User className="h-4 w-4 text-indigo-600" />
                                                    <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Personal Information</h4>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                    {renderField("firstName", "First Name", "text", true)}
                                                    {renderField("middleName", "Middle Name", "text", false)}
                                                    {renderField("lastName", "Last Name", "text", true)}
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    {renderField("email", "Email Address", "email", true)}
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Mobile Number*</label>
                                                        <div className="flex gap-1.5">
                                                            <select value={formValues.mobileCountryCode || "+91"} onChange={e => setFormValues(prev => ({...prev, mobileCountryCode: e.target.value}))} className="px-2.5 py-2 text-xs border border-slate-200 rounded-xl bg-white outline-none font-semibold focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500">
                                                                <option value="+91">+91</option>
                                                                <option value="+1">+1</option>
                                                                <option value="+44">+44</option>
                                                                <option value="+61">+61</option>
                                                                <option value="+65">+65</option>
                                                                <option value="+971">+971</option>
                                                            </select>
                                                            <input type="text" value={formValues.mobileNumber || ""} onChange={e => setFormValues(prev => ({...prev, mobileNumber: e.target.value}))} className={cn("flex-1 px-3 py-2 text-xs border rounded-xl outline-none font-semibold focus:ring-2 focus:ring-indigo-100 bg-white", !!validationErrors.mobileNumber ? "border-rose-400 focus:ring-rose-100 focus:border-rose-400 bg-rose-50/10" : "border-slate-200 focus:border-indigo-500")} required />
                                                        </div>
                                                        {validationErrors.mobileNumber && <p className="text-[10px] text-rose-550 font-bold mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {validationErrors.mobileNumber}</p>}
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                    {renderField("dob", "Date of Birth", "date", true)}
                                                    {renderField("gender", "Gender", "select", true, ["Male", "Female", "Other"])}
                                                    {renderField("maritalStatus", "Marital Status", "select", true, ["Single", "Married", "Divorced", "Widowed"])}
                                                </div>
                                            </div>

                                            {/* Mailing Address */}
                                            <div className="p-4 border border-slate-100 bg-slate-50/50 rounded-2xl space-y-4 shadow-2xs">
                                                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                                                    <MapPin className="h-4 w-4 text-indigo-600" />
                                                    <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Mailing Address</h4>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    {renderField("mailingAddress1", "Address 1", "text", true)}
                                                    {renderField("mailingAddress2", "Address 2", "text", false)}
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                                    <div className="col-span-2">
                                                        {renderField("mailingCountry", "Country", "select", true, ALL_COUNTRIES)}
                                                    </div>
                                                    {renderField("mailingState", "State", "text", true)}
                                                    {renderField("mailingCity", "City", "text", true)}
                                                </div>
                                                <div className="w-1/3">
                                                    {renderField("mailingPincode", "Pincode", "text", true)}
                                                </div>
                                            </div>

                                            {/* Permanent Address */}
                                            <div className="p-4 border border-slate-100 bg-slate-50/50 rounded-2xl space-y-4 shadow-2xs">
                                                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                                    <div className="flex items-center gap-2">
                                                        <MapPin className="h-4 w-4 text-indigo-600" />
                                                        <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Permanent Address</h4>
                                                    </div>
                                                    <label className="flex items-center gap-1.5 text-xs text-slate-600 font-extrabold cursor-pointer select-none">
                                                        <input type="checkbox" checked={!!formValues.permAddressSame} onChange={e => {
                                                            const checked = e.target.checked;
                                                            setFormValues(prev => ({
                                                                ...prev,
                                                                permAddressSame: checked,
                                                                ...(checked ? {
                                                                    permAddress1: prev.mailingAddress1,
                                                                    permAddress2: prev.mailingAddress2,
                                                                    permCountry: prev.mailingCountry,
                                                                    permState: prev.mailingState,
                                                                    permCity: prev.mailingCity,
                                                                    permPincode: prev.mailingPincode,
                                                                } : {
                                                                    permAddress1: "",
                                                                    permAddress2: "",
                                                                    permCountry: "",
                                                                    permState: "",
                                                                    permCity: "",
                                                                    permPincode: "",
                                                                })
                                                            }));
                                                        }} className="rounded border-slate-350 text-indigo-600 h-4 w-4" />
                                                        Same as mailing address
                                                    </label>
                                                </div>
                                                {!formValues.permAddressSame && (
                                                    <div className="space-y-4 animate-in fade-in duration-200">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                            {renderField("permAddress1", "Address 1", "text", true)}
                                                            {renderField("permAddress2", "Address 2", "text", false)}
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                                            <div className="col-span-2">
                                                                {renderField("permCountry", "Country", "select", true, ALL_COUNTRIES)}
                                                            </div>
                                                            {renderField("permState", "State", "text", true)}
                                                            {renderField("permCity", "City", "text", true)}
                                                        </div>
                                                        <div className="w-1/3">
                                                            {renderField("permPincode", "Pincode", "text", true)}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Passport Information */}
                                            <div className="p-4 border border-slate-100 bg-slate-50/50 rounded-2xl space-y-4 shadow-2xs">
                                                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                                                    <FileText className="h-4 w-4 text-indigo-600" />
                                                    <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Passport Information</h4>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                    {renderField("passportNumber", "Passport Number", "text", true)}
                                                    {renderField("passportIssueDate", "Issue Date", "date", true)}
                                                    {renderField("passportExpiryDate", "Expiry Date", "date", true)}
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                    {renderField("passportIssueCountry", "Issue Country", "select", true, ALL_COUNTRIES)}
                                                    {renderField("passportCityOfBirth", "City of Birth", "text", true)}
                                                    {renderField("passportCountryOfBirth", "Country of Birth", "select", true, ALL_COUNTRIES)}
                                                </div>
                                            </div>

                                            {/* Nationality & Citizenship */}
                                            <div className="p-4 border border-slate-100 bg-slate-50/50 rounded-2xl space-y-4 shadow-2xs">
                                                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                                                    <Globe className="h-4 w-4 text-indigo-600" />
                                                    <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Nationality & Citizenship</h4>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    {renderField("nationality", "Nationality", "select", true, ALL_COUNTRIES)}
                                                    {renderField("citizenship", "Citizenship", "select", true, ALL_COUNTRIES)}
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Citizen of more than one country?*</label>
                                                        <div className="flex gap-4 pt-1">
                                                            {["No", "Yes"].map(opt => (
                                                                <label key={opt} className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer font-bold">
                                                                    <input type="radio" checked={formValues.dualCitizenship === opt} onChange={() => setFormValues(prev => ({...prev, dualCitizenship: opt}))} className="text-indigo-600 h-4 w-4" />
                                                                    {opt}
                                                                </label>
                                                            ))}
                                                        </div>
                                                        {formValues.dualCitizenship === "Yes" && (
                                                            <div className="pt-1">
                                                                {renderField("dualCitizenshipCountries", "Other Countries", "text", true)}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Living/studying in other country?*</label>
                                                        <div className="flex gap-4 pt-1">
                                                            {["No", "Yes"].map(opt => (
                                                                <label key={opt} className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer font-bold">
                                                                    <input type="radio" checked={formValues.otherCountryStudy === opt} onChange={() => setFormValues(prev => ({...prev, otherCountryStudy: opt}))} className="text-indigo-600 h-4 w-4" />
                                                                    {opt}
                                                                </label>
                                                            ))}
                                                        </div>
                                                        {formValues.otherCountryStudy === "Yes" && (
                                                            <div className="pt-1">
                                                                {renderField("otherCountryStudyName", "Select Living Country", "select", true, ALL_COUNTRIES)}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Background Info */}
                                            <div className="p-4 border border-slate-100 bg-slate-50/50 rounded-2xl space-y-4 shadow-2xs">
                                                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                                                    <ShieldAlert className="h-4 w-4 text-indigo-600" />
                                                    <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Background Info</h4>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Applied for immigration in any country?</label>
                                                        <div className="flex gap-4 pt-1">
                                                            {["No", "Yes"].map(opt => (
                                                                <label key={opt} className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer font-bold">
                                                                    <input type="radio" checked={formValues.appliedImmigration === opt} onChange={() => setFormValues(prev => ({...prev, appliedImmigration: opt}))} className="text-indigo-600 h-4 w-4" />
                                                                    {opt}
                                                                </label>
                                                            ))}
                                                        </div>
                                                        {formValues.appliedImmigration === "Yes" && (
                                                            <div className="pt-1">
                                                                {renderField("appliedImmigrationCountry", "Immigration Country", "select", true, ALL_COUNTRIES)}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Suffer from serious medical condition?</label>
                                                        <div className="flex gap-4 pt-1">
                                                            {["No", "Yes"].map(opt => (
                                                                <label key={opt} className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer font-bold">
                                                                    <input type="radio" checked={formValues.medicalCondition === opt} onChange={() => setFormValues(prev => ({...prev, medicalCondition: opt}))} className="text-indigo-600 h-4 w-4" />
                                                                    {opt}
                                                                </label>
                                                            ))}
                                                        </div>
                                                        {formValues.medicalCondition === "Yes" && (
                                                            <div className="pt-1">
                                                                {renderField("medicalConditionDetails", "Medical Details", "text", true)}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Visa refusal for any country?</label>
                                                        <div className="flex gap-4 pt-1">
                                                            {["No", "Yes"].map(opt => (
                                                                <label key={opt} className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer font-bold">
                                                                    <input type="radio" checked={formValues.visaRefusal === opt} onChange={() => setFormValues(prev => ({...prev, visaRefusal: opt}))} className="text-indigo-600 h-4 w-4" />
                                                                    {opt}
                                                                </label>
                                                            ))}
                                                        </div>
                                                        {formValues.visaRefusal === "Yes" && (
                                                            <div className="grid grid-cols-2 gap-2 pt-1">
                                                                {renderField("visaRefusalCountry", "Refusal Country", "select", true, ALL_COUNTRIES)}
                                                                {renderField("visaRefusalType", "Type of Visa", "text", true)}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Convicted of criminal offence?</label>
                                                        <div className="flex gap-4 pt-1">
                                                            {["No", "Yes"].map(opt => (
                                                                <label key={opt} className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer font-bold">
                                                                    <input type="radio" checked={formValues.criminalConviction === opt} onChange={() => setFormValues(prev => ({...prev, criminalConviction: opt}))} className="text-indigo-600 h-4 w-4" />
                                                                    {opt}
                                                                </label>
                                                            ))}
                                                        </div>
                                                        {formValues.criminalConviction === "Yes" && (
                                                            <div className="pt-1">
                                                                {renderField("criminalConvictionDetails", "Conviction Details", "text", true)}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Emergency Contacts */}
                                            <div className="p-4 border border-slate-100 bg-slate-50/50 rounded-2xl space-y-4 shadow-2xs">
                                                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                                                    <Phone className="h-4 w-4 text-indigo-600" />
                                                    <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Emergency Contacts</h4>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    {renderField("emergencyName", "Name", "text", false)}
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Mobile Number</label>
                                                        <div className="flex gap-1.5">
                                                            <select value={formValues.emergencyPhoneCountryCode || "+91"} onChange={e => setFormValues(prev => ({...prev, emergencyPhoneCountryCode: e.target.value}))} className="px-2.5 py-2 text-xs border border-slate-200 rounded-xl bg-white outline-none font-semibold focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500">
                                                                <option value="+91">+91</option>
                                                                <option value="+1">+1</option>
                                                                <option value="+44">+44</option>
                                                            </select>
                                                            <input type="text" value={formValues.emergencyPhone || ""} onChange={e => setFormValues(prev => ({...prev, emergencyPhone: e.target.value}))} className={cn("flex-1 px-3 py-2 text-xs border rounded-xl outline-none font-semibold focus:ring-2 focus:ring-indigo-100 bg-white", !!validationErrors.emergencyPhone ? "border-rose-400 focus:ring-rose-100 focus:border-rose-400 bg-rose-50/10" : "border-slate-200 focus:border-indigo-500")} />
                                                        </div>
                                                        {validationErrors.emergencyPhone && <p className="text-[10px] text-rose-550 font-bold mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {validationErrors.emergencyPhone}</p>}
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    {renderField("emergencyEmail", "Email", "email", false)}
                                                    {renderField("emergencyRelation", "Relation with Applicant", "text", false)}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Step 2: Academic Details */}
                                    {prospectStep === 2 && (
                                        <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#c7d2fe transparent' }}>
                                            {/* Education Summary Card */}
                                            <div className="p-4 border border-indigo-100 bg-indigo-50/20 rounded-2xl space-y-4 shadow-2xs">
                                                <div className="flex items-center justify-between border-b border-indigo-100 pb-2.5">
                                                    <div className="flex items-center gap-2">
                                                        <BookOpen className="h-4 w-4 text-indigo-600" />
                                                        <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Education Summary</h4>
                                                    </div>
                                                    <span className="text-[9px] font-extrabold px-2.5 py-0.5 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200">
                                                        Step 2 of 4
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide flex items-center gap-1">Country of Education <span className="text-rose-500">*</span></label>
                                                        <select value={formValues.countryOfEducation || ""} onChange={e => setFormValues(prev => ({...prev, countryOfEducation: e.target.value}))} className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white outline-none font-semibold transition-all focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500">
                                                            <option value="">Select Country</option>
                                                            {ALL_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                                                        </select>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide flex items-center gap-1">Highest Level of Education <span className="text-rose-500">*</span></label>
                                                        <select value={formValues.highestLevelOfEducation || ""} onChange={e => setFormValues(prev => ({...prev, highestLevelOfEducation: e.target.value}))} className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white outline-none font-semibold transition-all focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500">
                                                            <option value="">Select Highest Level</option>
                                                            <option value="Postgraduate">Postgraduate</option>
                                                            <option value="Undergraduate">Undergraduate</option>
                                                            <option value="Grade 12th or equivalent">Grade 12th or equivalent</option>
                                                            <option value="Grade 10th or equivalent">Grade 10th or equivalent</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                {formValues.highestLevelOfEducation && (
                                                    <p className="text-[10px] text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-2 rounded-xl font-semibold leading-relaxed">
                                                        📚 Fill in details for each education level below. Sections are shown based on your highest level of education.
                                                    </p>
                                                )}
                                            </div>

                                            {/* PG Block */}
                                            {formValues.highestLevelOfEducation === "Postgraduate" && (
                                                <AcademicBlock prefix="pg" label="Post Graduate" setFormValues={setFormValues} formValues={formValues} validationErrors={validationErrors} />
                                            )}

                                            {/* UG Block */}
                                            {["Postgraduate", "Undergraduate"].includes(formValues.highestLevelOfEducation) && (
                                                <AcademicBlock prefix="ug" label="Undergraduate" setFormValues={setFormValues} formValues={formValues} isUG validationErrors={validationErrors} />
                                            )}

                                            {/* 12th Block */}
                                            {["Postgraduate", "Undergraduate", "Grade 12th or equivalent"].includes(formValues.highestLevelOfEducation) && (
                                                <AcademicBlock prefix="x12" label="Grade 12th or equivalent" setFormValues={setFormValues} formValues={formValues} isSchool validationErrors={validationErrors} />
                                            )}

                                            {/* 10th Block */}
                                            {formValues.highestLevelOfEducation && (
                                                <AcademicBlock prefix="x10" label="Grade 10th or equivalent" setFormValues={setFormValues} formValues={formValues} isSchool validationErrors={validationErrors} />
                                            )}
                                        </div>
                                    )}

                                    {/* Step 3: Work Experience */}
                                    {prospectStep === 3 && (
                                        <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-2">
                                            {!formValues.hasWorkExperience ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setFormValues(prev => ({ 
                                                        ...prev, 
                                                        hasWorkExperience: true,
                                                        workExperiences: prev.workExperiences?.length ? prev.workExperiences : [{ workOrgAddress: "", workPosition: "", workSalaryMode: "", workJobProfile: "", workFrom: "", workUpto: "", workCurrent: false }]
                                                    }))}
                                                    className="w-full py-8 border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl flex flex-col items-center justify-center gap-2 bg-slate-50/30 hover:bg-indigo-50/10 transition-all group cursor-pointer"
                                                >
                                                    <div className="p-3 bg-white rounded-full shadow-xs border border-slate-100 group-hover:scale-110 transition-transform">
                                                        <Briefcase className="h-5 w-5 text-indigo-500" />
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-600 group-hover:text-indigo-600">Add Work Experience</span>
                                                    <p className="text-[10px] text-slate-455">Include any professional history, internships, or jobs</p>
                                                </button>
                                            ) : (
                                                <div className="space-y-4">
                                                    {formValues.workExperiences?.map((exp, index) => (
                                                        <div key={index} className="p-4 border border-slate-100 bg-slate-50/50 rounded-2xl space-y-4 shadow-2xs relative">
                                                            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                                                <div className="flex items-center gap-2">
                                                                    <Briefcase className="h-4 w-4 text-indigo-650" />
                                                                    <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Work Experience #{index + 1}</h4>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setFormValues(prev => {
                                                                            const updated = prev.workExperiences.filter((_, i) => i !== index);
                                                                            return {
                                                                                ...prev,
                                                                                workExperiences: updated,
                                                                                hasWorkExperience: updated.length > 0
                                                                            };
                                                                        });
                                                                    }}
                                                                    className="text-[10px] font-bold text-rose-500 hover:text-rose-700 flex items-center gap-1 bg-rose-50 hover:bg-rose-100/80 px-2.5 py-1 rounded-lg transition-colors"
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" /> Remove
                                                                </button>
                                                            </div>

                                                            <div className="space-y-4 mt-2">
                                                                {renderField(`workExperiences.${index}.workOrgAddress`, "Name of the Organisation & Address", "text", true)}
                                                                
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                    {renderField(`workExperiences.${index}.workPosition`, "Position", "text", true)}
                                                                    {renderField(`workExperiences.${index}.workSalaryMode`, "Mode of Salary", "select", false, ["Bank Transfer", "Cheque", "Cash"])}
                                                                </div>

                                                                <div className="space-y-1">
                                                                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Job Profile</label>
                                                                    <textarea 
                                                                        rows={2.5} 
                                                                        value={exp?.workJobProfile || ""} 
                                                                        onChange={e => setFormValues(prev => {
                                                                            const updated = [...prev.workExperiences];
                                                                            updated[index] = { ...updated[index], workJobProfile: e.target.value };
                                                                            return { ...prev, workExperiences: updated };
                                                                        })} 
                                                                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none resize-none bg-white font-semibold focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all" 
                                                                        placeholder="Describe your responsibilities and achievements..."
                                                                    />
                                                                </div>

                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                    {renderField(`workExperiences.${index}.workFrom`, "Working From", "date", true)}
                                                                    {renderField(`workExperiences.${index}.workUpto`, "Working Upto", "date", !exp?.workCurrent)}
                                                                </div>

                                                                <label className="flex items-center gap-1.5 text-xs text-slate-600 font-extrabold cursor-pointer select-none pt-1">
                                                                    <input 
                                                                        type="checkbox" 
                                                                        checked={!!exp?.workCurrent} 
                                                                        onChange={e => setFormValues(prev => {
                                                                            const updated = [...prev.workExperiences];
                                                                            updated[index] = { ...updated[index], workCurrent: e.target.checked };
                                                                            return { ...prev, workExperiences: updated };
                                                                        })} 
                                                                        className="rounded border-slate-355 text-indigo-600 h-4 w-4" 
                                                                    />
                                                                    I am currently working here
                                                                </label>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormValues(prev => ({
                                                            ...prev,
                                                            workExperiences: [...(prev.workExperiences || []), { workOrgAddress: "", workPosition: "", workSalaryMode: "", workJobProfile: "", workFrom: "", workUpto: "", workCurrent: false }]
                                                        }))}
                                                        className="w-full py-3.5 border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl flex items-center justify-center gap-2 bg-white hover:bg-indigo-50/5 text-xs font-bold text-slate-600 hover:text-indigo-600 transition-all cursor-pointer shadow-xs"
                                                    >
                                                        <Plus className="h-4 w-4" /> Add More Work Experience
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Step 4: Tests */}
                                    {prospectStep === 4 && (
                                        <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-2">
                                            <div className="p-4 border border-slate-100 bg-slate-50/50 rounded-2xl space-y-4 shadow-2xs">
                                                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                                                    <Award className="h-4 w-4 text-indigo-600" />
                                                    <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Test Scores (Optional)</h4>
                                                </div>

                                                <p className="text-[10px] text-slate-450 -mt-2">Click "+ Add Test" to enter scores for a specific test</p>

                                                <div className="space-y-3">
                                                    {["GRE", "GMAT", "IELTS", "TOEFL", "PTE", "DET", "SAT", "ACT"].map(testName => {
                                                        const isAdded = activeTests.includes(testName);
                                                        
                                                        return (
                                                            <div key={testName} className="border border-slate-100 rounded-xl bg-white overflow-hidden shadow-3xs transition-all">
                                                                <div className="w-full py-3 px-4 flex items-center justify-between font-bold text-xs bg-slate-50/55 border-b border-slate-100">
                                                                    <span className="flex items-center gap-2 text-slate-700">
                                                                        <Award className={cn("h-4 w-4", isAdded ? "text-indigo-600" : "text-slate-400")} />
                                                                        {testName}
                                                                        {isAdded && (
                                                                            <span className="text-[9px] bg-indigo-50 text-indigo-750 px-2 py-0.5 rounded-full font-extrabold animate-pulse">Active</span>
                                                                        )}
                                                                    </span>
                                                                    
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            if (isAdded) {
                                                                                setFormValues(prev => {
                                                                                    const updatedScores = { ...prev.testScores };
                                                                                    delete updatedScores[testName];
                                                                                    return { ...prev, testScores: updatedScores };
                                                                                });
                                                                                setActiveTests(prev => prev.filter(t => t !== testName));
                                                                            } else {
                                                                                setActiveTests(prev => [...prev, testName]);
                                                                            }
                                                                        }}
                                                                        className={cn(
                                                                            "text-[10px] font-extrabold flex items-center gap-1 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-3xs",
                                                                            isAdded 
                                                                                ? "bg-rose-50 text-rose-600 hover:bg-rose-100/80" 
                                                                                : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100/80"
                                                                        )}
                                                                    >
                                                                        {isAdded ? (
                                                                            <>
                                                                                <Trash2 className="h-3.5 w-3.5" /> Remove
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <Plus className="h-3.5 w-3.5" /> Add Test
                                                                            </>
                                                                        )}
                                                                    </button>
                                                                </div>
                                                                
                                                                {isAdded && (
                                                                    <div className="p-4 space-y-4 bg-white animate-in slide-in-from-top-2 duration-200">
                                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                            {renderTestField(testName, "overall", "Overall Score", "text", true)}
                                                                            {renderTestField(testName, "date", "Date of Examination", "date", false)}
                                                                        </div>
                                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                                            {renderTestField(testName, "quant", "Quantitative", "text", false)}
                                                                            {renderTestField(testName, "verbal", "Verbal", "text", false)}
                                                                            {renderTestField(testName, "aw", "Analytical Writing", "text", false)}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {currentStage === "PROSPECT" && (
                                        <p className="text-[11px] text-blue-600 bg-blue-50 border border-blue-100 p-2.5 rounded-lg leading-relaxed font-semibold mt-4">
                                            ℹ️ System Action: Loan department will be activated instantly on submit.
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* UNIVERSITY_SHORTLISTING Form */}
                            {currentStage === "UNIVERSITY_SHORTLISTING" && !isProfileMode && (
                                <div className="space-y-6">
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
                            {currentStage === "APPLICATION" && !isProfileMode && (
                                <div className="space-y-6">
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

                                                <div className="space-y-1.5 text-left">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-xs font-semibold text-slate-500 uppercase">Third Party Name</label>
                                                        {newPortalIndex !== index && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setNewPortalIndex(index);
                                                                    setNewPortalVal("");
                                                                }}
                                                                className="text-[10px] font-bold text-indigo-650 hover:text-indigo-850 transition-colors cursor-pointer"
                                                            >
                                                                + Add Third Party Option
                                                            </button>
                                                        )}
                                                    </div>
                                                    {newPortalIndex === index ? (
                                                        <div className="flex gap-2">
                                                            <input
                                                                type="text"
                                                                placeholder="Enter new third party name"
                                                                value={newPortalVal}
                                                                onChange={e => setNewPortalVal(e.target.value)}
                                                                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-105 focus:border-indigo-500 bg-white font-medium"
                                                                onKeyDown={e => {
                                                                    if (e.key === "Enter") {
                                                                        e.preventDefault();
                                                                        if (newPortalVal.trim()) addPortalMut.mutate(newPortalVal.trim());
                                                                    }
                                                                }}
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    if (newPortalVal.trim()) addPortalMut.mutate(newPortalVal.trim());
                                                                }}
                                                                disabled={addPortalMut.isPending || !newPortalVal.trim()}
                                                                className="px-3.5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 disabled:opacity-50"
                                                            >
                                                                Save
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setNewPortalIndex(null);
                                                                    setNewPortalVal("");
                                                                }}
                                                                className="px-3.5 py-2 border border-slate-250 text-slate-650 rounded-xl text-xs font-bold hover:bg-slate-50"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <select
                                                            value={univ.univ_portal || ""}
                                                            onChange={e => updateUniversityField(index, "univ_portal", e.target.value)}
                                                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-105 focus:border-indigo-500 bg-white"
                                                        >
                                                            <option value="">Select Third Party (Optional)</option>
                                                            {portals.map(p => (
                                                                <option key={p.id} value={p.name}>{p.name}</option>
                                                            ))}
                                                        </select>
                                                    )}
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
                                                        { univ_country: "", univ_name: "", univ_course: "", univ_link: "", completed: false, univ_portal: "" }
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
                            {currentStage === "AWAITING_STATUS" && !isProfileMode && (
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
                                                    {univ.univ_portal && (
                                                        <div className="text-[10px] text-indigo-650 font-bold bg-indigo-50/50 w-fit px-1.5 py-0.5 rounded mt-1">
                                                            Portal: {univ.univ_portal}
                                                        </div>
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

                                            <div className="space-y-1.5 pt-1 text-left">
                                                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                                                    <input
                                                        type="checkbox"
                                                        checked={!!univ.confirmed}
                                                        onChange={e => {
                                                            const updated = [...(formValues.universities || [])];
                                                            updated[index] = { ...updated[index], confirmed: e.target.checked };
                                                            setFormValues({ ...formValues, universities: updated });
                                                        }}
                                                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-200 h-4 w-4"
                                                    />
                                                    Confirmed for Admission
                                                </label>
                                            </div>

                                            {/* Per-university deposit button */}
                                            <div className="pt-2 border-t border-slate-100">
                                                {univDepositModal?.univName === univ.univ_name ? (
                                                    // Inline deposit form
                                                    <div className="space-y-3 bg-emerald-50/60 border border-emerald-100 rounded-xl p-3">
                                                        <div className="flex items-center gap-1.5 mb-1">
                                                            <Wallet className="h-3.5 w-3.5 text-emerald-600" />
                                                            <span className="text-xs font-bold text-emerald-700">Add Deposit for {univ.univ_name}</span>
                                                        </div>
                                                        <input
                                                            type="text"
                                                            placeholder="Deposit Amount (e.g. £5,000)"
                                                            value={univDepositModal.amount || ""}
                                                            onChange={e => setUnivDepositModal(s => ({ ...s, amount: e.target.value }))}
                                                            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 bg-white font-semibold"
                                                        />
                                                        <select
                                                            value={DEPOSIT_BUILT_IN_MODES.includes(univDepositModal.mode) ? univDepositModal.mode : (univDepositModal.mode ? "__custom__" : "")}
                                                            onChange={e => {
                                                                const val = e.target.value;
                                                                if (val === "__custom__") {
                                                                    setUnivDepositModal(s => ({ ...s, mode: "__custom__", customMode: "" }));
                                                                } else {
                                                                    setUnivDepositModal(s => ({ ...s, mode: val, customMode: "" }));
                                                                }
                                                            }}
                                                            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 bg-white font-semibold"
                                                        >
                                                            <option value="">— Mode of Payment —</option>
                                                            {DEPOSIT_BUILT_IN_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                                                            <option value="__custom__">➕ Add Custom...</option>
                                                        </select>
                                                        {(univDepositModal.mode === "__custom__" || (!DEPOSIT_BUILT_IN_MODES.includes(univDepositModal.mode) && univDepositModal.mode)) && (
                                                            <input
                                                                autoFocus
                                                                type="text"
                                                                placeholder="Custom payment mode..."
                                                                value={univDepositModal.customMode || ""}
                                                                onChange={e => setUnivDepositModal(s => ({ ...s, customMode: e.target.value }))}
                                                                className="w-full px-3 py-2 text-xs border border-emerald-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 bg-white font-semibold"
                                                            />
                                                        )}
                                                        <input
                                                            type="date"
                                                            value={univDepositModal.date || ""}
                                                            onChange={e => setUnivDepositModal(s => ({ ...s, date: e.target.value }))}
                                                            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 bg-white font-semibold"
                                                        />
                                                        <div className="flex gap-2 pt-1">
                                                            <button
                                                                type="button"
                                                                disabled={univDepositModal.saving}
                                                                onClick={async () => {
                                                                    const resolvedMode = univDepositModal.mode === "__custom__"
                                                                        ? (univDepositModal.customMode || "").trim()
                                                                        : (univDepositModal.mode || "");
                                                                    if (!univDepositModal.amount && !resolvedMode) return;
                                                                    setUnivDepositModal(s => ({ ...s, saving: true }));
                                                                    try {
                                                                        const cf = lead?.customFields || {};
                                                                        const prevHistory = Array.isArray(cf.deposit_history) ? cf.deposit_history : [];
                                                                        const entry = {
                                                                            deposit_amount: univDepositModal.amount || "",
                                                                            payment_mode: resolvedMode,
                                                                            payment_date: univDepositModal.date || "",
                                                                            deposit_college: univ.univ_name,
                                                                            recordedAt: new Date().toISOString(),
                                                                        };
                                                                        await api.patch(`/leads/${lead.id}/custom-fields`, {
                                                                            fields: {
                                                                                deposit_amount: univDepositModal.amount || cf.deposit_amount || "",
                                                                                payment_mode: resolvedMode || cf.payment_mode || "",
                                                                                payment_date: univDepositModal.date || cf.payment_date || "",
                                                                                deposit_college: univ.univ_name,
                                                                                deposit_history: [entry, ...prevHistory],
                                                                            }
                                                                        });
                                                                        const paidOn = univDepositModal.date
                                                                            ? new Date(univDepositModal.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                                                                            : "—";
                                                                        await api.post(`/leads/${lead.id}/notes`, {
                                                                            content: `💰 Deposit recorded — Amount: ${univDepositModal.amount || "—"} · Mode: ${resolvedMode || "—"} · Date: ${paidOn} · College: ${univ.univ_name}`
                                                                        });
                                                                        toast.success(`Deposit saved for ${univ.univ_name}`);
                                                                        onChanged();
                                                                        setUnivDepositModal(null);
                                                                    } catch (err) {
                                                                        toast.error(err?.response?.data?.message || "Failed to save deposit");
                                                                        setUnivDepositModal(s => ({ ...s, saving: false }));
                                                                    }
                                                                }}
                                                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 transition-colors"
                                                            >
                                                                {univDepositModal.saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wallet className="h-3.5 w-3.5" />}
                                                                Save Deposit
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setUnivDepositModal(null)}
                                                                className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => setUnivDepositModal({ univName: univ.univ_name, amount: "", mode: "", date: "", customMode: "", saving: false })}
                                                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors"
                                                    >
                                                        <Wallet className="h-3.5 w-3.5" />
                                                        Add Deposit for this University
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    <p className="text-[11px] text-blue-600 bg-blue-50 border border-blue-100 p-2.5 rounded-lg leading-relaxed font-semibold mt-3">
                                        ℹ️ System Action: Forex department will be activated instantly on submit.
                                    </p>
                                </div>
                            )}

                            {/* DEPOSIT_STATUS Payment */}
                            {currentStage === "DEPOSIT_STATUS" && !isProfileMode && (() => {
                                const shortlist = Array.isArray(customFields.shortlisted_universities)
                                    ? customFields.shortlisted_universities
                                    : customFields.univ_name
                                        ? [{ univ_name: customFields.univ_name, univ_country: customFields.univ_country || "", univ_course: customFields.univ_course || "" }]
                                        : [];
                                return (
                                <div className="space-y-4">
                                    {/* College selector */}
                                    {shortlist.length > 0 && (
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-slate-500 uppercase">Select College / University</label>
                                            <select
                                                required
                                                value={formValues.deposit_college || ""}
                                                onChange={e => setFormValues({ ...formValues, deposit_college: e.target.value })}
                                                className="w-full px-3 py-2 text-sm border border-indigo-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-indigo-50/30 font-semibold text-slate-700"
                                            >
                                                <option value="">— Select College —</option>
                                                {shortlist.map((u, idx) => (
                                                    <option key={idx} value={u.univ_name}>
                                                        {u.univ_name}{u.univ_country ? ` · ${u.univ_country}` : ""}{u.univ_course ? ` (${u.univ_course})` : ""}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-500 uppercase">Deposit Amount</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="e.g. $5,000 CAD / £3,000"
                                            value={formValues.deposit_amount || ""}
                                            onChange={e => setFormValues({ ...formValues, deposit_amount: e.target.value })}
                                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-500 uppercase">Mode of Payment</label>
                                        <select
                                            required
                                            value={
                                                DEPOSIT_BUILT_IN_MODES.includes(formValues.payment_mode)
                                                    ? formValues.payment_mode
                                                    : formValues.payment_mode
                                                        ? "__custom__"
                                                        : ""
                                            }
                                            onChange={e => {
                                                const val = e.target.value;
                                                if (val === "__custom__") {
                                                    setFormValues({ ...formValues, payment_mode: "__custom__" });
                                                } else {
                                                    setCustomPaymentMode("");
                                                    setFormValues({ ...formValues, payment_mode: val });
                                                }
                                            }}
                                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-white"
                                        >
                                            <option value="">— Select —</option>
                                            {DEPOSIT_BUILT_IN_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                                            <option value="__custom__">➕ Add Custom...</option>
                                        </select>
                                        {(formValues.payment_mode === "__custom__" || (!DEPOSIT_BUILT_IN_MODES.includes(formValues.payment_mode) && formValues.payment_mode)) && (
                                            <input
                                                autoFocus
                                                type="text"
                                                placeholder="Type custom payment mode..."
                                                value={customPaymentMode}
                                                onChange={e => {
                                                    setCustomPaymentMode(e.target.value);
                                                    setFormValues({ ...formValues, payment_mode: e.target.value || "__custom__" });
                                                }}
                                                className="w-full px-3 py-2 text-sm border border-indigo-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 mt-1"
                                            />
                                        )}
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-500 uppercase">Date of Payment</label>
                                        <input
                                            type="date"
                                            required
                                            value={formValues.payment_date || ""}
                                            onChange={e => setFormValues({ ...formValues, payment_date: e.target.value })}
                                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                                        />
                                    </div>
                                    <p className="text-[11px] text-blue-600 bg-blue-50 border border-blue-100 p-2.5 rounded-lg leading-relaxed font-semibold mt-3">
                                        ℹ️ System Action: Accommodation department will be activated instantly on submit.
                                    </p>
                                </div>
                                );
                            })()}

                            {/* VISA_DOCUMENTATION Verification */}
                            {currentStage === "VISA_DOCUMENTATION" && !isProfileMode && (
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
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-500 uppercase">Visa Appointment Date</label>
                                        <input
                                            type="date"
                                            required
                                            value={formValues.visa_appointment_date || ""}
                                            onChange={e => setFormValues({ ...formValues, visa_appointment_date: e.target.value })}
                                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-white text-left"
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
                            {currentStage === "VISA_STATUS" && !isProfileMode && (
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

                                    {(formValues.embassy_result || "Approved") === "Approved" && (
                                        <>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-semibold text-slate-500 uppercase">Date of Visa Approved</label>
                                                <input
                                                    type="date"
                                                    value={formValues.visa_approved_date || ""}
                                                    onChange={e => setFormValues({ ...formValues, visa_approved_date: e.target.value })}
                                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                                                />
                                            </div>
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
                                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-white"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-semibold text-slate-500 uppercase">Proof of Visa Approved</label>
                                                <label className={cn(
                                                    "flex items-center justify-center gap-2 w-full px-3 py-2.5 text-xs font-bold border border-dashed rounded-xl cursor-pointer transition-colors",
                                                    uploadingProof ? "border-slate-200 text-slate-400" : "border-indigo-300 text-indigo-650 hover:bg-indigo-50/50"
                                                )}>
                                                    {uploadingProof
                                                        ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
                                                        : <><UploadCloud className="h-4 w-4" /> Upload proof document</>}
                                                    <input
                                                        type="file"
                                                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                                        className="hidden"
                                                        disabled={uploadingProof}
                                                        onChange={e => { handleVisaProofUpload(e.target.files?.[0]); e.target.value = ""; }}
                                                    />
                                                </label>
                                                <p className="text-[10px] text-slate-400">Appears in the lead's Documents list once uploaded.</p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* COMMISSION_INVOICING details */}
                            {currentStage === "COMMISSION_INVOICING" && !isProfileMode && (
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
                            <div className="flex items-center justify-between border-t border-gray-100 pt-3.5 mt-4 w-full">
                                <div>
                                    <button
                                        type="button"
                                        onClick={attemptCloseModal}
                                        className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                                <div className="flex items-center gap-2">
                                    {(currentStage === "PROSPECT" || isProfileMode) ? (
                                        <>
                                            {prospectStep > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setProspectStep(s => s - 1)}
                                                    className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all border border-slate-205"
                                                >
                                                    Back
                                                </button>
                                            )}
                                            {prospectStep < 4 ? (
                                                <button
                                                    key="next-btn"
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        setProspectStep(s => s + 1);
                                                    }}
                                                    className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-sm flex items-center gap-1"
                                                >
                                                    Next <ArrowRight className="h-3.5 w-3.5" />
                                                </button>
                                            ) : (
                                                <button
                                                    key="save-btn"
                                                    type="submit"
                                                    disabled={loading}
                                                    className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                                                >
                                                    {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                                    Save Profile
                                                </button>
                                            )}
                                        </>
                                    ) : (
                                        null
                                    )}
                                    {currentStage !== "PROSPECT" && !isProfileMode && (
                                        <>
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
                                        </>
                                    )}
                                </div>
                            </div>
                        </form>

                        {/* Discard-changes confirmation */}
                        {showCloseConfirm && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-sm rounded-2xl" onClick={e => e.stopPropagation()}>
                                <div className="bg-white border border-slate-200 rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4 space-y-4">
                                    <div className="flex items-start gap-3">
                                        <div className="h-9 w-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                                            <AlertCircle className="h-5 w-5 text-amber-500" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-800">Discard unsaved changes?</h4>
                                            <p className="text-xs text-slate-500 mt-1">Any details you've entered will be lost if you close now.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowCloseConfirm(false)}
                                            className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                                        >
                                            Keep editing
                                        </button>
                                        <button
                                            type="button"
                                            onClick={confirmCloseModal}
                                            className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors"
                                        >
                                            Discard
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
