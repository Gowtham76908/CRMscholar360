import { Building2 } from "lucide-react";
import { departmentLabel } from "../lib/departments";

/**
 * Reusable department picker for dashboards / reports. Pure presentation —
 * the caller owns selection state (see useDepartmentSelection for defaults).
 * Renders as pills when there are few options, a dropdown when many.
 */
export default function DepartmentSelector({ value, onChange, options = [], className = "" }) {
    if (!options.length) {
        return (
            <div className={`inline-flex items-center gap-1.5 text-xs text-gray-400 ${className}`}>
                <Building2 className="h-3.5 w-3.5" /> No departments
            </div>
        );
    }

    if (options.length <= 4) {
        return (
            <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
                {options.map((d) => (
                    <button
                        key={d}
                        onClick={() => onChange(d)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                            value === d
                                ? "bg-indigo-600 text-white border-indigo-600"
                                : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
                        }`}
                    >
                        {departmentLabel(d)}
                    </button>
                ))}
            </div>
        );
    }

    return (
        <div className={`relative inline-flex items-center ${className}`}>
            <Building2 className="h-3.5 w-3.5 text-gray-400 absolute left-2.5 pointer-events-none" />
            <select
                value={value || ""}
                onChange={(e) => onChange(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-sm font-semibold border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
                {options.map((d) => (
                    <option key={d} value={d}>{departmentLabel(d)}</option>
                ))}
            </select>
        </div>
    );
}
