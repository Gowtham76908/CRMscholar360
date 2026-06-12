import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../api/axios";
import { Loader2, AlertTriangle, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

// System field keys that map to top-level Lead columns (not customFields JSON)
const SYSTEM_KEYS = new Set([
    "name", "phone", "email", "company", "source",
    "enquiryType", "biodata", "jobTitle", "linkedinUrl", "category",
]);

// Human-readable labels for enum values
const ENUM_LABELS = {
    FACEBOOK: "Facebook", INSTAGRAM: "Instagram", GMAIL: "Gmail",
    WEBSITE: "Website", PHONE_CALL: "Phone Call", LINKEDIN: "LinkedIn",
    PRODUCT: "Product", WHITE_LABEL: "White Label", LMS: "LMS", SERVICES: "Services",
};

function FieldInput({ def, value, onChange }) {
    const cls = "w-full px-4 py-3 text-sm border border-gray-200 rounded-xl bg-gray-50/50 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all shadow-sm";

    if (def.type === "SELECT" && def.options?.length) {
        return (
            <select className={`${cls} appearance-none bg-white`} value={value ?? ""} onChange={e => onChange(e.target.value)}>
                <option value="">— Select —</option>
                {def.options.map(o => (
                    <option key={o} value={o}>{ENUM_LABELS[o] ?? o}</option>
                ))}
            </select>
        );
    }
    if (def.type === "TEXTAREA") {
        return (
            <textarea
                className={`${cls} resize-none`}
                rows={3}
                placeholder={def.name}
                value={value ?? ""}
                onChange={e => onChange(e.target.value)}
            />
        );
    }
    if (def.type === "DATE") {
        return <input type="date" className={cls} value={value ?? ""} onChange={e => onChange(e.target.value)} />;
    }
    if (def.type === "NUMBER") {
        return <input type="number" className={cls} placeholder={def.name} value={value ?? ""} onChange={e => onChange(e.target.value)} />;
    }
    if (def.type === "CHECKBOX") {
        return (
            <div className="flex items-center gap-2 h-9">
                <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} className="accent-indigo-600 h-4 w-4" />
                <span className="text-xs font-semibold text-gray-500">{def.name}</span>
            </div>
        );
    }
    return (
        <input
            type={def.fieldKey === "email" ? "email" : def.fieldKey === "phone" ? "tel" : "text"}
            className={cls}
            placeholder={def.name}
            value={value ?? ""}
            onChange={e => onChange(e.target.value)}
        />
    );
}

// Pass `lead` prop to enter edit mode; omit it for create mode
const AddLeadForm = ({ onClose, lead }) => {
    const queryClient = useQueryClient();
    const isEdit = !!lead;
    const [errors, setErrors] = useState({});

    const { data: allFields = [], isLoading: fieldsLoading } = useQuery({
        queryKey: ["lead-fields"],
        queryFn: () => api.get("/custom-fields").then(r => r.data),
        staleTime: 5 * 60_000,
    });

    const visibleFields = allFields.filter(f => f.visible);

    // Build initial values from lead (edit mode) or empty
    const buildInitial = () => {
        if (!isEdit) return {};
        const vals = {};
        for (const f of visibleFields) {
            if (SYSTEM_KEYS.has(f.fieldKey)) {
                vals[f.fieldKey] = lead[f.fieldKey] ?? "";
            } else {
                vals[f.fieldKey] = lead.customFields?.[f.fieldKey] ?? "";
            }
        }
        return vals;
    };

    const [values, setValues] = useState(buildInitial);
    const [followUpDate, setFollowUpDate] = useState(() => {
        if (!isEdit || !lead?.nextFollowUpAt) return "";
        return new Date(lead.nextFollowUpAt).toISOString().split("T")[0];
    });
    const [duplicates, setDuplicates] = useState([]);
    const [ignoreDuplicates, setIgnoreDuplicates] = useState(false);
    const dupTimer = useRef(null);

    const setField = (key, val) => {
        setValues(v => ({ ...v, [key]: val }));
        if (isEdit) return;
        if (key !== "phone" && key !== "email") return;
        clearTimeout(dupTimer.current);
        dupTimer.current = setTimeout(async () => {
            const phone = key === "phone" ? val : values.phone;
            const email = key === "email" ? val : values.email;
            if (!phone && !email) return;
            try {
                const { data } = await api.post("/leads/check-duplicate", { phone, email });
                setDuplicates(data.existingLeads ?? []);
                if (data.existingLeads?.length) setIgnoreDuplicates(false);
            } catch {
                // silently ignore
            }
        }, 600);
    };

    const validate = () => {
        const errs = {};
        for (const f of visibleFields) {
            if (!f.required) continue;
            const val = values[f.fieldKey];
            if (val === undefined || val === null || val === "") {
                errs[f.fieldKey] = `${f.name} is required`;
            }
        }
        return errs;
    };

    const mutation = useMutation({
        mutationFn: async (payload) => {
            if (isEdit) return api.patch(`/leads/${lead.id}`, payload);
            return api.post("/leads", payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["leads"] });
            onClose();
        },
    });

    const onSubmit = (e) => {
        e.preventDefault();
        const errs = validate();
        if (Object.keys(errs).length > 0) { setErrors(errs); return; }
        setErrors({});
        if (!isEdit && duplicates.length > 0 && !ignoreDuplicates) {
            setIgnoreDuplicates(true);
            return;
        }

        // Split into system fields (top-level) and custom fields (JSON)
        const systemData = {};
        const customData = {};

        for (const f of visibleFields) {
            const val = values[f.fieldKey];
            if (val === "" || val === undefined || val === null) continue;
            if (SYSTEM_KEYS.has(f.fieldKey)) {
                systemData[f.fieldKey] = val;
            } else {
                customData[f.fieldKey] = val;
            }
        }

        const payload = { ...systemData };
        if (Object.keys(customData).length > 0) {
            payload.customFields = customData;
        }
        if (isEdit && followUpDate) {
            payload.nextFollowUpAt = followUpDate;
        }

        mutation.mutate(payload);
    };

    if (fieldsLoading) {
        return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-indigo-400" /></div>;
    }

    // Group fields into pairs for two-column layout, but full-width for textarea
    const fieldPairs = [];
    let i = 0;
    while (i < visibleFields.length) {
        const f = visibleFields[i];
        if (f.type === "TEXTAREA") {
            fieldPairs.push([f]);
            i++;
        } else if (visibleFields[i + 1] && visibleFields[i + 1].type !== "TEXTAREA") {
            fieldPairs.push([f, visibleFields[i + 1]]);
            i += 2;
        } else {
            fieldPairs.push([f]);
            i++;
        }
    }

    return (
        <form onSubmit={onSubmit} className="space-y-4">
            {fieldPairs.map((pair, pi) => (
                <div key={pi} className={pair.length === 2 ? "grid grid-cols-2 gap-4" : ""}>
                    {pair.map(def => (
                        <div key={def.id}>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                                {def.name}
                                {def.required && <span className="text-red-500 ml-0.5">*</span>}
                            </label>
                            <FieldInput
                                def={def}
                                value={values[def.fieldKey]}
                                onChange={val => setField(def.fieldKey, val)}
                            />
                            {errors[def.fieldKey] && (
                                <p className="text-red-500 text-xs mt-0.5 font-semibold">{errors[def.fieldKey]}</p>
                            )}
                        </div>
                    ))}
                </div>
            ))}

            {isEdit && (
                <div className="border-t border-gray-100 pt-4">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                        Follow-up Date
                        <span className="ml-1 text-[10px] text-gray-400 font-normal normal-case">(optional)</span>
                    </label>
                    <input
                        type="date"
                        className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl bg-gray-50/50 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all shadow-sm"
                        value={followUpDate}
                        onChange={e => setFollowUpDate(e.target.value)}
                    />
                    {followUpDate && new Date(followUpDate) < new Date() && (
                        <p className="text-xs text-red-500 mt-1 font-semibold">This date is in the past — lead will appear overdue.</p>
                    )}
                </div>
            )}

            {!isEdit && duplicates.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-amber-800 text-sm font-semibold">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                        {duplicates.length === 1 ? "Possible duplicate found" : `${duplicates.length} possible duplicates found`}
                    </div>
                    <ul className="space-y-0.5">
                        {duplicates.slice(0, 3).map(d => (
                            <li key={d.id} className="flex items-center gap-1 text-xs text-amber-700">
                                <span className="font-medium">{d.name}</span>
                                {d.phone && <span>· {d.phone}</span>}
                                {d.email && <span>· {d.email}</span>}
                                <Link to={`/leads/${d.id}`} target="_blank" className="ml-auto text-amber-600 hover:text-amber-800">
                                    <ExternalLink className="h-3 w-3" />
                                </Link>
                            </li>
                        ))}
                    </ul>
                    {ignoreDuplicates && (
                        <p className="text-xs text-amber-700 font-medium">Click "Save Lead" again to create anyway.</p>
                    )}
                </div>
            )}

            {mutation.isError && (
                <p className="text-sm text-red-600">
                    {mutation.error?.response?.data?.message || "Failed to save lead. Please try again."}
                </p>
            )}

            <div className="flex justify-end pt-6 gap-3">
                <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-2.5 text-sm font-bold text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors border border-gray-100"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={mutation.isPending}
                    className="inline-flex justify-center items-center px-8 py-2.5 text-sm font-bold text-white bg-indigo-600 border border-transparent rounded-xl hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-lg shadow-indigo-100 disabled:opacity-50 transition-all"
                >
                    {mutation.isPending ? <Loader2 className="animate-spin h-4 w-4" /> : isEdit ? "Save Changes" : "Save Lead"}
                </button>
            </div>
        </form>
    );
};

export default AddLeadForm;
