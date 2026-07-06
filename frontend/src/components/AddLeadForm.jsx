import { useState, useEffect, useRef, forwardRef, useMemo } from "react";
import { useForm, FormProvider, useFormContext, useController } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/axios";
import {
    Loader2, X, User, GraduationCap, Megaphone,
    ChevronRight, ChevronLeft, Check, AlertTriangle, ChevronDown, Search, Plus,
} from "lucide-react";
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { getExampleNumber } from "libphonenumber-js";
import examples from "libphonenumber-js/mobile/examples";
import { cn } from "../lib/utils";

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

const STANDARD_OTHER_COUNTRIES = [
    "New Zealand", "Singapore", "France", "Sweden", "Netherlands", 
    "Italy", "Spain", "Switzerland", "United Arab Emirates", 
    "Malaysia", "Japan", "South Korea", "Finland", "Norway", "Denmark"
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

// 10 terms ≈ 2.5 years of intakes (4 terms = one academic year).
const INTAKE_OPTIONS = generateIntakeTerms(10);

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
    leadSubSource: z.string().optional(),
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

    const containerBorderCls = err
        ? "border-red-400 ring-2 ring-red-100"
        : "border-gray-200 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100";

    return (
        <div className="space-y-1">
            <div className={`flex items-center border rounded-xl bg-white transition-all overflow-hidden ${containerBorderCls}`}>
                <PhoneInput
                    international
                    defaultCountry="IN"
                    value={field.value}
                    onChange={(val) => {
                        field.onChange(val || "");
                        if (onChangeCallback) onChangeCallback(val || "");
                    }}
                    onCountryChange={setCountry}
                    inputComponent={PhoneInputCustomComponent}
                />
            </div>
            {err && <p className="text-red-500 text-xs mt-1 font-medium">{err.message}</p>}
        </div>
    );
}

// ─── Multi-select pill group ──────────────────────────────────────────────────
function RHFMultiSelect({ name, options }) {
    const { control, formState: { errors } } = useFormContext();
    const err = name.split(".").reduce((o, k) => o?.[k], errors);
    const { field } = useController({ name, control, defaultValue: [] });

    // Local state for custom countries & search
    const [customCountries, setCustomCountries] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem("crm-custom-countries") || "[]");
        } catch (e) {
            return [];
        }
    });

    const [showOtherDropdown, setShowOtherDropdown] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const dropdownRef = useRef(null);

    // Close dropdown on click outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowOtherDropdown(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggle = (opt) => {
        const cur = field.value || [];
        field.onChange(cur.includes(opt) ? cur.filter(v => v !== opt) : [...cur, opt]);
    };

    // Combine standard other countries and custom countries
    const allOtherCountries = useMemo(() => {
        const set = new Set([
            ...STANDARD_OTHER_COUNTRIES,
            ...customCountries
        ]);
        // Remove the main options to avoid duplicates
        options.forEach(o => set.delete(o));
        return Array.from(set).sort();
    }, [customCountries, options]);

    // Filtered other countries based on search query
    const filteredOtherCountries = useMemo(() => {
        if (!searchQuery) return allOtherCountries;
        const q = searchQuery.toLowerCase().trim();
        return allOtherCountries.filter(c => c.toLowerCase().includes(q));
    }, [allOtherCountries, searchQuery]);

    // Check if the search query matches any country exactly (case-insensitive)
    const hasExactMatch = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return true;
        return allOtherCountries.some(c => c.toLowerCase() === q) || options.some(c => c.toLowerCase() === q);
    }, [allOtherCountries, options, searchQuery]);

    const handleAddCountry = () => {
        const raw = searchQuery.trim();
        if (!raw) return;
        
        // Convert to Title Case
        const formatted = raw.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
        
        // Check if it already exists case-insensitively
        const lowerFormatted = formatted.toLowerCase();
        const existingInMain = options.find(o => o.toLowerCase() === lowerFormatted);
        const existingInOthers = allOtherCountries.find(o => o.toLowerCase() === lowerFormatted);

        if (existingInMain) {
            toggle(existingInMain);
        } else if (existingInOthers) {
            toggle(existingInOthers);
        } else {
            // Add to custom countries and save to localStorage
            const updated = [...customCountries, formatted];
            setCustomCountries(updated);
            localStorage.setItem("crm-custom-countries", JSON.stringify(updated));
            toggle(formatted);
        }
        setSearchQuery("");
    };

    const mainOptions = options.filter(o => o !== "Other");
    const selectedValues = field.value || [];

    // Selected countries that are not in the main options list
    const selectedOtherCountries = selectedValues.filter(v => !mainOptions.includes(v));

    return (
        <div className="space-y-3">
            {/* Main Options Pills */}
            <div className="flex flex-wrap gap-2 mt-1">
                {mainOptions.map(opt => {
                    const active = selectedValues.includes(opt);
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

                {/* Selected "Other" Countries Pills */}
                {selectedOtherCountries.map(opt => (
                    <button
                        key={opt}
                        type="button"
                        onClick={() => toggle(opt)}
                        className="px-3.5 py-2 rounded-xl text-sm font-semibold border bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-200 flex items-center gap-1.5"
                    >
                        {opt}
                        <X className="h-3.5 w-3.5 shrink-0 text-indigo-200 hover:text-white transition-colors" />
                    </button>
                ))}

                {/* Other Countries Dropdown Trigger */}
                <div className="relative" ref={dropdownRef}>
                    <button
                        type="button"
                        onClick={() => setShowOtherDropdown(prev => !prev)}
                        className={`px-3.5 py-2 rounded-xl text-sm font-semibold border transition-all flex items-center gap-1.5 ${
                            showOtherDropdown
                                ? "bg-indigo-50 border-indigo-350 text-indigo-650"
                                : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600"
                        }`}
                    >
                        Other Countries...
                        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showOtherDropdown ? "rotate-180" : ""}`} />
                    </button>

                    {/* Searchable Dropdown Panel */}
                    {showOtherDropdown && (
                        <div className="absolute left-0 mt-2 w-72 bg-white rounded-2xl border border-gray-200 shadow-xl z-50 p-3.5 space-y-3 animate-fadeIn">
                            {/* Search Box */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search or add country..."
                                    className="pl-9 pr-8 w-full border border-gray-200 rounded-xl py-2 text-xs focus:ring-2 focus:ring-indigo-150 focus:border-indigo-400 outline-none bg-gray-55"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            if (!hasExactMatch) {
                                                handleAddCountry();
                                            }
                                        }
                                    }}
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery("")}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Countries List */}
                            <div className="max-h-48 overflow-y-auto space-y-1 pr-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent text-left">
                                {filteredOtherCountries.map(country => {
                                    const active = selectedValues.includes(country);
                                    return (
                                        <button
                                            key={country}
                                            type="button"
                                            onClick={() => toggle(country)}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors ${
                                                active
                                                    ? "bg-indigo-50 text-indigo-700"
                                                    : "hover:bg-gray-50 text-gray-700"
                                            }`}
                                        >
                                            <span>{country}</span>
                                            {active && <Check className="h-3.5 w-3.5 text-indigo-600" />}
                                        </button>
                                    );
                                })}

                                {filteredOtherCountries.length === 0 && searchQuery && hasExactMatch && (
                                    <p className="text-xs text-gray-400 text-center py-4">No countries found</p>
                                )}
                            </div>

                            {/* Add Custom Country Option */}
                            {searchQuery && !hasExactMatch && (
                                <div className="border-t border-gray-100 pt-2">
                                    <button
                                        type="button"
                                        onClick={handleAddCountry}
                                        className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-indigo-600 hover:bg-indigo-50 flex items-center gap-1.5 transition-colors"
                                    >
                                        <Plus className="h-3.5 w-3.5 shrink-0" />
                                        Add "{searchQuery.trim()}"
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            {err && <p className="text-red-500 text-xs mt-1.5 font-medium">{err.message}</p>}
        </div>
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

// ─── Sub-Source Selector (for Reference / Education Fair) ────────────────────
function RHFSubSourceSelect({ name, source }) {
    const { register, setValue, watch } = useFormContext();
    const currentValue = watch(name) || "";
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const containerRef = useRef(null);

    // Load custom sub-sources from localStorage
    const [customSources, setCustomSources] = useState(() => {
        try {
            const saved = localStorage.getItem("crm-custom-sub-sources");
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    const standardOptions = ["Offline", "Online", "Event"];
    
    // Combine standard and custom options, removing duplicates case-insensitively
    const allOptions = useMemo(() => {
        const seen = new Set();
        const result = [];
        [...standardOptions, ...customSources].forEach(opt => {
            const lower = opt.trim().toLowerCase();
            if (!seen.has(lower)) {
                seen.add(lower);
                result.push(opt.trim());
            }
        });
        return result;
    }, [customSources]);

    // Filtered options based on search query
    const filteredOptions = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return allOptions;
        return allOptions.filter(opt => opt.toLowerCase().includes(query));
    }, [allOptions, searchQuery]);

    // Check if the exact query exists (case-insensitive)
    const showAddButton = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return false;
        return !allOptions.some(opt => opt.toLowerCase() === query);
    }, [allOptions, searchQuery]);

    // Format query to Title Case
    const toTitleCase = (str) => {
        return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
    };

    const handleSelect = (val) => {
        setValue(name, val, { shouldValidate: true, shouldDirty: true });
        setIsOpen(false);
        setSearchQuery("");
    };

    const handleAddCustom = () => {
        const trimmed = searchQuery.trim();
        if (!trimmed) return;
        const formatted = toTitleCase(trimmed);
        
        // Add to state and save to localStorage
        const updated = [...customSources, formatted];
        setCustomSources(updated);
        localStorage.setItem("crm-custom-sub-sources", JSON.stringify(updated));
        
        handleSelect(formatted);
    };

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={containerRef}>
            <input type="hidden" {...register(name)} />
            
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "w-full px-3.5 py-2.5 text-sm border rounded-xl bg-white outline-none transition-all flex items-center justify-between text-left",
                    isOpen ? "border-indigo-500 ring-2 ring-indigo-100" : "border-gray-205 hover:border-gray-300"
                )}
            >
                <span className={cn(currentValue ? "text-gray-900 font-medium" : "text-gray-400")}>
                    {currentValue || `Select ${source.toLowerCase()} detail...`}
                </span>
                <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform duration-200", isOpen && "transform rotate-180")} />
            </button>

            {isOpen && (
                <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-150 rounded-xl shadow-xl z-50 p-2.5 space-y-2 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
                    {/* Search bar */}
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
                        <input
                            type="text"
                            placeholder={`Search or add custom ${source.toLowerCase()}...`}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 outline-none focus:bg-white focus:border-indigo-550 focus:ring-2 focus:ring-indigo-100"
                            autoFocus
                        />
                    </div>

                    {/* Options list */}
                    <div className="space-y-0.5">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((opt) => (
                                <button
                                    key={opt}
                                    type="button"
                                    onClick={() => handleSelect(opt)}
                                    className={cn(
                                        "w-full text-left px-2.5 py-1.5 text-xs rounded-lg font-semibold transition-colors flex items-center justify-between",
                                        currentValue === opt
                                            ? "bg-indigo-50 text-indigo-700"
                                            : "text-gray-600 hover:bg-gray-55"
                                    )}
                                >
                                    <span>{opt}</span>
                                    {currentValue === opt && <Check className="h-3.5 w-3.5 text-indigo-650" />}
                                </button>
                            ))
                        ) : (
                            !showAddButton && (
                                <p className="text-[11px] text-gray-400 text-center py-2">No options found</p>
                            )
                        )}
                    </div>

                    {/* Add custom option button */}
                    {showAddButton && (
                        <div className="border-t border-gray-100 pt-2 mt-1">
                            <button
                                type="button"
                                onClick={handleAddCustom}
                                className="w-full text-left px-2.5 py-2 text-xs text-indigo-650 hover:bg-indigo-50/70 rounded-lg font-bold flex items-center gap-1.5 transition-colors"
                            >
                                <Plus className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                                <span className="truncate">Add "{toTitleCase(searchQuery)}"</span>
                            </button>
                        </div>
                    )}
                </div>
            )}
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

            {/* Conditionally show Sub-Source Dropdown */}
            {(selected === "Reference" || selected === "Education Fair") && (
                <Field name="leadSubSource" label={`${selected} Detail / Sub-Source`} hint="optional">
                    <RHFSubSourceSelect name="leadSubSource" source={selected} />
                </Field>
            )}

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
            leadSubSource:        lead?.customFields?.leadSubSource || "",
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
                ...(values.leadSubSource                 && { leadSubSource:        values.leadSubSource }),
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
                                {mutation.error?.response?.data?.error?.message || mutation.error?.response?.data?.message || "Failed to save. Try again."}
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
