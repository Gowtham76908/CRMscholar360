import { useState, useEffect, useRef, forwardRef } from "react";
import { useForm, FormProvider, useFormContext, useController } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/axios";
import {
    Loader2, X, User, GraduationCap, Megaphone,
    ChevronRight, ChevronLeft, Check, AlertTriangle, ChevronDown, Search,
} from "lucide-react";
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { getExampleNumber } from "libphonenumber-js";
import examples from "libphonenumber-js/mobile/examples";

// ─── Constants ────────────────────────────────────────────────────────────────

const DESTINATION_OPTIONS = [
    "United Kingdom",
    "United States",
    "Canada",
    "Australia",
    "Ireland",
    "Germany",
    "Other",
];

/**
 * Generates the next `count` intake terms starting from the term AFTER
 * the current one. Terms follow the academic calendar:
 *   Spring  → Jan–Mar
 *   Summer  → Apr–Jun
 *   Fall    → Jul–Sep
 *   Winter  → Oct–Dec
 *
 * Example (June 2026 = Summer 2026):
 *   → Fall 2026, Winter 2026, Spring 2027, Summer 2027, Fall 2027, Winter 2027
 */
function generateIntakeTerms(count = 6) {
    const TERMS = ["Spring", "Summer", "Fall", "Winter"];

    // Map 1-based month → term index
    const termIndexForMonth = (m) => {
        if (m <= 3)  return 0; // Spring
        if (m <= 6)  return 1; // Summer
        if (m <= 9)  return 2; // Fall
        return 3;              // Winter
    };

    const now   = new Date();
    let year    = now.getFullYear();
    let termIdx = termIndexForMonth(now.getMonth() + 1) + 1; // start at NEXT term

    const terms = [];
    for (let i = 0; i < count; i++) {
        if (termIdx >= TERMS.length) { termIdx = 0; year++; }
        terms.push(`${TERMS[termIdx]} ${year}`);
        termIdx++;
    }
    return terms;
}

const INTAKE_OPTIONS = generateIntakeTerms(6);

const LEAD_SOURCE_OPTIONS = [
    { label: "Walk-in",                       backendValue: "PHONE_CALL" },
    { label: "Google Ads",                    backendValue: "WEBSITE"    },
    { label: "Meta Ads (Instagram/Facebook)", backendValue: "FACEBOOK"   },
    { label: "Website Form",                  backendValue: "WEBSITE"    },
    { label: "Reference",                     backendValue: "PHONE_CALL" },
    { label: "Education Fair",                backendValue: "PHONE_CALL" },
];



// ─── Steps metadata ───────────────────────────────────────────────────────────

const STEPS = [
    { id: "contact",     label: "Core Contact",       sublabel: "Name, phone & email",            icon: User        },
    { id: "preferences", label: "Study Preferences",  sublabel: "Destination & intake term",      icon: GraduationCap },
    { id: "attribution", label: "Marketing",           sublabel: "Lead source & attribution",      icon: Megaphone   },
];

const STEP_FIELDS = {
    contact:     ["fullName", "mobileNumber", "phone", "email"],
    preferences: ["destinationCountries", "intakeTerm"],
    attribution: ["leadSource"],
};

// ─── Country data ─────────────────────────────────────────────────────────────
const contactSchema = z.object({
    fullName: z.string().min(2, "Full name must be at least 2 characters"),
    mobileNumber: z
        .preprocess((val) => val || "", z.string())
        .refine(
            (val) => val.trim().length > 0,
            { message: "Mobile number is required" }
        )
        .refine(
            (val) => isValidPhoneNumber(val),
            { message: "Enter a valid phone number according to country format" }
        ),
    phone: z
        .preprocess((val) => val || "", z.string())
        .refine(
            (val) => val.trim().length > 0,
            { message: "WhatsApp number is required" }
        )
        .refine(
            (val) => isValidPhoneNumber(val),
            { message: "Enter a valid phone number according to country format" }
        ),
    email: z.string().email("Enter a valid email address"),
    sameAsMobile: z.boolean().optional(),
});

const preferencesSchema = z.object({
    destinationCountries: z.array(z.string()).min(1, "Select at least one destination"),
    intakeTerm:           z.string().optional(),
});

const attributionSchema = z.object({
    leadSource: z.string().min(1, "Lead source is required"),
});

const masterSchema = contactSchema.merge(preferencesSchema).merge(attributionSchema);

// ─── Shared style tokens ──────────────────────────────────────────────────────

const inputBase =
    "w-full px-3.5 py-2.5 text-sm border rounded-xl bg-white outline-none transition-all " +
    "placeholder-gray-400 focus:ring-2";
const inputOk  = "border-gray-200 focus:border-indigo-500 focus:ring-indigo-100";
const inputErr = "border-red-400 bg-red-50/30 focus:border-red-400 focus:ring-red-100";
const labelCls = "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5";

// ─── Shared text input component ──────────────────────────────────────────────
function RHFInput({ name, type = "text", placeholder }) {
    const { register, formState: { errors } } = useFormContext();
    const err = name.split(".").reduce((o, k) => o?.[k], errors);
    return (
        <input
            type={type}
            placeholder={placeholder}
            className={`${inputBase} ${err ? inputErr : inputOk}`}
            {...register(name)}
        />
    );
}

// ─── Field wrapper – reads errors from FormContext ────────────────────────────
function Field({ name, label, required, hint, children }) {
    const { formState: { errors } } = useFormContext();
    const err = name.split(".").reduce((o, k) => o?.[k], errors);
    return (
        <div>
            <label className={labelCls}>
                {label}
                {required && <span className="text-red-500 ml-0.5">*</span>}
                {hint && <span className="ml-1.5 text-gray-400 font-normal normal-case text-[11px]">{hint}</span>}
            </label>
            {children}
            {err && <p className="text-red-500 text-xs mt-1 font-medium">{err.message}</p>}
        </div>
    );
}

// ─── Custom WhatsApp / Phone field ───────────────────────────────────────────
const PhoneInputCustomComponent = forwardRef((props, ref) => (
    <input
        {...props}
        ref={ref}
        className="flex-1 min-w-0 px-3.5 py-2.5 text-sm outline-none bg-transparent text-gray-800 placeholder-gray-400 border-0 focus:ring-0 focus:outline-none"
    />
));
PhoneInputCustomComponent.displayName = "PhoneInputCustomComponent";

function RHFPhoneInput({ name, onChangeCallback }) {
    const { control, formState: { errors } } = useFormContext();
    const err = errors[name];
    const { field } = useController({ name, control, defaultValue: "" });
    const [country, setCountry] = useState("IN");

    // Get example placeholder dynamically
    let placeholder = "Enter phone number";
    try {
        const example = getExampleNumber(country || "IN", examples);
        if (example) {
            placeholder = example.formatInternational();
        }
    } catch (e) {
        // Fallback
    }

    const containerBorderCls = err
        ? "border-red-400 ring-2 ring-red-100"
        : "border-gray-200 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100";

    return (
        <div className="space-y-1">
            <div className={`phone-input-container rounded-xl border bg-white overflow-hidden transition-all ${containerBorderCls}`}>
                <PhoneInput
                    {...field}
                    onChange={(value) => {
                        field.onChange(value);
                        if (onChangeCallback) {
                            onChangeCallback(value);
                        }
                    }}
                    defaultCountry="IN"
                    country={country}
                    onCountryChange={(c) => {
                        if (c) setCountry(c);
                    }}
                    placeholder={placeholder}
                    inputComponent={PhoneInputCustomComponent}
                    className="w-full flex items-center bg-transparent"
                />
            </div>

            {/* Zod error */}
            {err && (
                <p className="text-red-500 text-xs font-medium flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                    {err.message}
                </p>
            )}
        </div>
    );
}

// ─── Multi-select pill group ──────────────────────────────────────────────────
function RHFMultiSelect({ name, options }) {
    const { control, formState: { errors } } = useFormContext();
    const err = name.split(".").reduce((o, k) => o?.[k], errors);
    const { field } = useController({ name, control, defaultValue: [] });

    const toggle = (opt) => {
        const cur = field.value || [];
        field.onChange(cur.includes(opt) ? cur.filter(v => v !== opt) : [...cur, opt]);
    };

    return (
        <>
            <div className="flex flex-wrap gap-2 mt-1">
                {options.map(opt => {
                    const active = (field.value || []).includes(opt);
                    return (
                        <button
                            key={opt}
                            type="button"
                            onClick={() => toggle(opt)}
                            className={`px-3.5 py-2 rounded-xl text-sm font-semibold border transition-all ${
                                active
                                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-200"
                                    : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600"
                            }`}
                        >
                            {opt}
                        </button>
                    );
                })}
            </div>
            {err && <p className="text-red-500 text-xs mt-1.5 font-medium">{err.message}</p>}
        </>
    );
}

// ─── Styled native select ─────────────────────────────────────────────────────
function RHFSelect({ name, options, placeholder }) {
    const { register, formState: { errors } } = useFormContext();
    const err = name.split(".").reduce((o, k) => o?.[k], errors);
    return (
        <div className="relative">
            <select
                className={`${inputBase} ${err ? inputErr : inputOk} appearance-none pr-9 cursor-pointer`}
                {...register(name)}
            >
                {placeholder && <option value="">{placeholder}</option>}
                {options.map(o => (
                    <option key={typeof o === "string" ? o : o.value} value={typeof o === "string" ? o : o.value}>
                        {typeof o === "string" ? o : o.label}
                    </option>
                ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                <svg className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"/>
                </svg>
            </div>
        </div>
    );
}

// ─── Step 1 – Core Contact Information ───────────────────────────────────────
function StepContact() {
    const { watch, setValue } = useFormContext();
    const sameAsMobile = watch("sameAsMobile");
    const mobileNumber = watch("mobileNumber");
    const whatsappNumber = watch("phone");
    const prevWhatsappRef = useRef(whatsappNumber);

    // Auto-sync mobile to WhatsApp when checkbox is checked
    useEffect(() => {
        if (sameAsMobile && mobileNumber) {
            setValue("phone", mobileNumber);
            prevWhatsappRef.current = mobileNumber;
        }
    }, [sameAsMobile, mobileNumber, setValue]);

    // Uncheck if WhatsApp number is manually edited
    useEffect(() => {
        if (sameAsMobile && whatsappNumber !== prevWhatsappRef.current) {
            // WhatsApp number was manually changed, uncheck the box
            if (whatsappNumber !== mobileNumber) {
                setValue("sameAsMobile", false);
            }
        }
        prevWhatsappRef.current = whatsappNumber;
    }, [whatsappNumber, sameAsMobile, mobileNumber, setValue]);

    return (
        <div className="space-y-5">
            <div className="flex items-center gap-3 p-4 bg-indigo-50/70 rounded-xl border border-indigo-100 mb-1">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-white" />
                </div>
                <div>
                    <p className="text-sm font-bold text-indigo-900">Core Contact Information</p>
                    <p className="text-xs text-indigo-500 mt-0.5">Basic details to identify and reach the lead</p>
                </div>
            </div>

            <Field name="fullName" label="Full Name" required>
                <RHFInput name="fullName" placeholder="John Doe" />
            </Field>

            <div>
                <label className={labelCls}>
                    Mobile Number
                    <span className="text-red-500 ml-0.5">*</span>
                    <span className="ml-1.5 text-gray-400 font-normal normal-case text-[11px]">
                        All countries · auto-formatted
                    </span>
                </label>
                <RHFPhoneInput name="mobileNumber" />
            </div>

            <div>
                <label className={labelCls}>
                    WhatsApp Number
                    <span className="text-red-500 ml-0.5">*</span>
                    <span className="ml-1.5 text-gray-400 font-normal normal-case text-[11px]">
                        All countries · auto-formatted
                    </span>
                </label>
                <RHFPhoneInput 
                    name="phone" 
                    onChangeCallback={(value) => {
                        // If user manually edits WhatsApp while checkbox is checked
                        // and the new value differs from mobile, uncheck it
                        if (sameAsMobile && value !== mobileNumber) {
                            setValue("sameAsMobile", false);
                        }
                    }}
                />
                
                {/* Checkbox for same as mobile */}
                <div className="mt-2 flex items-center gap-2">
                    <input
                        type="checkbox"
                        id="sameAsMobile"
                        checked={sameAsMobile || false}
                        onChange={(e) => {
                            setValue("sameAsMobile", e.target.checked);
                            if (e.target.checked && mobileNumber) {
                                setValue("phone", mobileNumber);
                            }
                        }}
                        className="w-4 h-4 text-indigo-600 bg-white border-gray-300 rounded focus:ring-indigo-500 focus:ring-2 cursor-pointer"
                    />
                    <label 
                        htmlFor="sameAsMobile" 
                        className="text-sm text-gray-600 cursor-pointer select-none"
                    >
                        Same as mobile number
                    </label>
                </div>
            </div>

            <Field name="email" label="Email Address" required>
                <RHFInput name="email" type="email" placeholder="john.doe@example.com" />
            </Field>
        </div>
    );
}

// ─── Step 2 – Study Preferences ───────────────────────────────────────────────
function StepPreferences() {
    const { watch } = useFormContext();
    const selected = watch("destinationCountries") || [];

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3 p-4 bg-violet-50/70 rounded-xl border border-violet-100 mb-1">
                <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center flex-shrink-0">
                    <GraduationCap className="h-4 w-4 text-white" />
                </div>
                <div>
                    <p className="text-sm font-bold text-violet-900">Study Preferences</p>
                    <p className="text-xs text-violet-500 mt-0.5">Where and when the student wants to study</p>
                </div>
            </div>

            <div>
                <Field name="destinationCountries" label="Preferred Destination Country" required>
                    <RHFMultiSelect name="destinationCountries" options={DESTINATION_OPTIONS} />
                </Field>
                {selected.length > 0 && (
                    <p className="text-xs text-indigo-600 mt-2 font-medium leading-relaxed">
                        ✓ {selected.join(" · ")}
                    </p>
                )}
            </div>

            <Field name="intakeTerm" label="Target Intake Term" hint="optional">
                <RHFSelect
                    name="intakeTerm"
                    options={INTAKE_OPTIONS}
                    placeholder="— Select intake term —"
                />
            </Field>
        </div>
    );
}

// ─── Step 3 – Marketing & Attribution ────────────────────────────────────────
function StepAttribution() {
    const { watch } = useFormContext();
    const selected = watch("leadSource");
    const sourceObj = LEAD_SOURCE_OPTIONS.find(s => s.label === selected);

    return (
        <div className="space-y-5">
            <div className="flex items-center gap-3 p-4 bg-emerald-50/70 rounded-xl border border-emerald-100 mb-1">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center flex-shrink-0">
                    <Megaphone className="h-4 w-4 text-white" />
                </div>
                <div>
                    <p className="text-sm font-bold text-emerald-900">Marketing & Attribution</p>
                    <p className="text-xs text-emerald-600 mt-0.5">How did this lead find you?</p>
                </div>
            </div>

            <Field name="leadSource" label="Lead Source" required>
                <RHFSelect
                    name="leadSource"
                    options={LEAD_SOURCE_OPTIONS.map(s => ({ value: s.label, label: s.label }))}
                    placeholder="— Select lead source —"
                />
            </Field>

            {/* Visual confirmation card */}
            {sourceObj && (
                <div className="flex items-center gap-3 p-3.5 bg-gray-50 border border-gray-200 rounded-xl animate-in fade-in duration-200">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <Check className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{sourceObj.label}</p>
                        <p className="text-xs text-gray-400">Mapped internally as <span className="font-mono text-indigo-600">{sourceObj.backendValue}</span></p>
                    </div>
                </div>
            )}

            {/* Summary preview */}
            <SummaryPreview />
        </div>
    );
}

// ─── Summary card shown on final step ─────────────────────────────────────────
function SummaryPreview() {
    const { watch } = useFormContext();
    const vals = watch();

    const rows = [
        { label: "Name",         value: vals.fullName },
        { label: "Mobile",       value: vals.mobileNumber },
        { label: "WhatsApp",     value: vals.phone },
        { label: "Email",        value: vals.email },
        { label: "Destinations", value: (vals.destinationCountries || []).join(", ") },
        { label: "Intake",       value: vals.intakeTerm },
    ].filter(r => r.value);

    if (rows.length === 0) return null;

    return (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Lead Summary</p>
            </div>
            <div className="divide-y divide-gray-100">
                {rows.map(r => (
                    <div key={r.label} className="flex items-start gap-3 px-4 py-2.5">
                        <span className="text-xs text-gray-400 font-semibold w-24 flex-shrink-0 pt-px">{r.label}</span>
                        <span className="text-sm text-gray-800 font-medium break-all">{r.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Step component map ───────────────────────────────────────────────────────
const STEP_COMPONENTS = [StepContact, StepPreferences, StepAttribution];

// ─── Main Dialog ──────────────────────────────────────────────────────────────
const AddLeadForm = ({ onClose, lead }) => {
    const queryClient  = useQueryClient();
    const [currentStep, setCurrentStep] = useState(0);
    const [duplicates,  setDuplicates]  = useState([]);
    const isEdit = !!lead;

    const methods = useForm({
        resolver: zodResolver(masterSchema),
        mode: "onTouched",
        defaultValues: {
            fullName:             lead?.name || "",
            mobileNumber:         lead?.customFields?.mobileNumber || "",
            phone:                lead?.phone || "",
            email:                lead?.email || "",
            sameAsMobile:         false,
            destinationCountries: lead?.customFields?.destinationCountries
                ? lead.customFields.destinationCountries.split(", ")
                : [],
            intakeTerm:           lead?.customFields?.intakeTerm || "",
            leadSource:           lead?.customFields?.leadSourceDetail ||
                                  LEAD_SOURCE_OPTIONS.find(s => s.backendValue === lead?.source)?.label ||
                                  "",
        },
    });

    const { handleSubmit, trigger, watch } = methods;

    // Duplicate check on email / phone change (debounced)
    const emailVal = watch("email");
    const phoneVal = watch("phone");
    useEffect(() => {
        if (isEdit) return;
        if (!emailVal && !phoneVal) { setDuplicates([]); return; }
        const t = setTimeout(async () => {
            try {
                const { data } = await api.post("/leads/check-duplicate", {
                    email: emailVal || undefined,
                    phone: phoneVal || undefined,
                });
                setDuplicates(data.existingLeads ?? []);
            } catch { /* silent */ }
        }, 700);
        return () => clearTimeout(t);
    }, [emailVal, phoneVal, isEdit]);

    const mutation = useMutation({
        mutationFn: async (payload) => {
            if (isEdit) {
                // Update system fields and custom fields in a single request
                await api.put(`/leads/${lead.id}`, {
                    name:         payload.name,
                    phone:        payload.phone,
                    email:        payload.email,
                    source:       payload.source,
                    customFields: payload.customFields,
                });
            } else {
                await api.post("/leads", payload);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["leads"] });
            queryClient.invalidateQueries({ queryKey: ["department-board"] });
            queryClient.invalidateQueries({ queryKey: ["department-queue"] });
            queryClient.invalidateQueries({ queryKey: ["lead-departments"] });
            if (isEdit) {
                queryClient.invalidateQueries({ queryKey: ["lead", lead.id] });
                queryClient.invalidateQueries({ queryKey: ["lead-activities", lead.id] });
            }
            onClose();
        },
    });

    const goNext = async () => {
        const stepId  = STEPS[currentStep].id;
        const isValid = await trigger(STEP_FIELDS[stepId]);
        if (isValid) setCurrentStep(s => s + 1);
    };

    const goPrev = () => setCurrentStep(s => s - 1);

    const onSubmit = (values) => {
        // Map friendly label → backend enum
        const sourceObj = LEAD_SOURCE_OPTIONS.find(s => s.label === values.leadSource);
        const backendSource = sourceObj?.backendValue ?? "WEBSITE";

        const payload = {
            name:        values.fullName.trim(),
            phone:       values.phone ? values.phone.replace(/\s+/g, "") : "",
            email:       values.email.trim() || undefined,
            source:      backendSource,
            enquiryType: "SERVICES",
            customFields: {
                ...(values.mobileNumber                  && { mobileNumber:         values.mobileNumber.replace(/\s+/g, "") }),
                ...(values.intakeTerm                    && { intakeTerm:           values.intakeTerm }),
                ...(values.destinationCountries?.length  && { destinationCountries: values.destinationCountries.join(", ") }),
                ...(values.leadSource                    && { leadSourceDetail:     values.leadSource }),
            },
        };

        mutation.mutate(payload);
    };

    const isLast = currentStep === STEPS.length - 1;
    const StepContent = STEP_COMPONENTS[currentStep];
    const step = STEPS[currentStep];

    // Accent colors per step
    const stepColors = [
        { gradient: "from-indigo-600 via-indigo-700 to-violet-700", ring: "focus:ring-indigo-500" },
        { gradient: "from-violet-600 via-violet-700 to-purple-700", ring: "focus:ring-violet-500" },
        { gradient: "from-emerald-600 via-emerald-700 to-teal-700", ring: "focus:ring-emerald-500" },
    ];
    const color = stepColors[currentStep];

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(15,23,42,0.6)", backdropFilter: "blur(6px)" }}
            onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div
                className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col"
                style={{ maxHeight: "92vh" }}
                onMouseDown={e => e.stopPropagation()}
            >
                {/* ── Header ── */}
                <div className={`relative overflow-hidden rounded-t-2xl bg-gradient-to-br ${color.gradient} px-6 pt-6 pb-5`}>
                    {/* decorative orbs */}
                    <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 blur-2xl pointer-events-none" />
                    <div className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full bg-black/10 blur-xl pointer-events-none" />

                    {/* Title row */}
                    <div className="relative flex items-start justify-between mb-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                {STEPS.map((s, i) => (
                                    <div key={s.id} className="flex items-center gap-1">
                                        <div className={`w-1.5 h-1.5 rounded-full transition-all ${
                                            i < currentStep  ? "bg-white" :
                                            i === currentStep ? "bg-white w-4 rounded-full" :
                                            "bg-white/30"
                                        }`} />
                                    </div>
                                ))}
                            </div>
                            <p className="text-white/70 text-xs font-semibold uppercase tracking-widest">
                                Step {currentStep + 1} of {STEPS.length}
                            </p>
                            <h2 className="text-white text-xl font-bold mt-0.5">
                                {isEdit ? "Edit Lead" : "Add New Lead"}
                            </h2>
                            <p className="text-white/75 text-sm mt-0.5">{step.label} — {step.sublabel}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/25 text-white transition-all hover:scale-105"
                            aria-label="Close"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Step tabs */}
                    <div className="relative flex gap-2">
                        {STEPS.map((s, i) => {
                            const Icon = s.icon;
                            const done   = i < currentStep;
                            const active = i === currentStep;
                            return (
                                <div
                                    key={s.id}
                                    className={`flex-1 flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-xl border transition-all ${
                                        done   ? "bg-white/20 border-white/30" :
                                        active ? "bg-white/25 border-white/50 shadow-sm" :
                                                 "bg-white/5 border-white/10"
                                    }`}
                                >
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                                        done   ? "bg-white text-current shadow" :
                                        active ? "bg-white/30 text-white" :
                                                 "bg-white/10 text-white/40"
                                    }`}
                                    style={done ? { color: currentStep === 0 ? "#4f46e5" : currentStep === 1 ? "#7c3aed" : "#059669" } : {}}
                                    >
                                        {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                                    </div>
                                    <span className={`text-[9px] font-bold uppercase tracking-wide text-center leading-tight ${
                                        active ? "text-white" : done ? "text-white/80" : "text-white/30"
                                    }`}>
                                        {s.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Progress bar */}
                    <div className="relative mt-3 h-1 bg-white/20 rounded-full overflow-hidden">
                        <div
                            className="absolute inset-y-0 left-0 bg-white rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
                        />
                    </div>
                </div>

                {/* ── Duplicate warning ── */}
                {duplicates.length > 0 && currentStep === 0 && (
                    <div className="mx-5 mt-4 flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                        <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-semibold text-amber-900">Possible duplicate detected</p>
                            <p className="text-xs text-amber-700 mt-0.5">
                                {duplicates.slice(0, 2).map(d => d.name).join(", ")}
                                {duplicates.length > 2 && ` +${duplicates.length - 2} more`}
                            </p>
                        </div>
                    </div>
                )}

                {/* ── Scrollable form body ── */}
                <FormProvider {...methods}>
                    <form
                        id="add-lead-form"
                        onSubmit={handleSubmit(onSubmit)}
                        className="flex-1 overflow-y-auto px-6 py-5"
                    >
                        <StepContent />
                    </form>
                </FormProvider>

                {/* ── Footer ── */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/70 rounded-b-2xl flex items-center justify-between gap-3">
                    {currentStep > 0 ? (
                        <button
                            type="button"
                            onClick={goPrev}
                            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Back
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 text-sm font-semibold text-gray-500 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                    )}

                    <div className="flex items-center gap-3">
                        {mutation.isError && (
                            <p className="text-xs text-red-600 font-medium max-w-[180px] text-right leading-tight">
                                {mutation.error?.response?.data?.message || "Failed to save. Try again."}
                            </p>
                        )}

                        {isLast ? (
                            <button
                                type="submit"
                                form="add-lead-form"
                                disabled={mutation.isPending}
                                className={`inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white rounded-xl bg-gradient-to-r ${color.gradient} hover:opacity-90 focus:outline-none focus:ring-2 ${color.ring} focus:ring-offset-2 shadow-lg disabled:opacity-50 transition-all`}
                            >
                                {mutation.isPending
                                    ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</>
                                    : <><Check className="h-4 w-4" />{isEdit ? "Save Changes" : "Save Lead"}</>
                                }
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={goNext}
                                className={`inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white rounded-xl bg-gradient-to-r ${color.gradient} hover:opacity-90 focus:outline-none focus:ring-2 ${color.ring} focus:ring-offset-2 shadow-lg transition-all`}
                            >
                                Next
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AddLeadForm;
