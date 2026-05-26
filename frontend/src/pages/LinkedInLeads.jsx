import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Search, Loader2, CheckSquare, Square, Users, ArrowRight,
    X, Briefcase, Building2, MapPin, Wifi, UserCircle2,
    Phone, Mail, FileText
} from "lucide-react";
import api from "../api/axios";
import { useQueryClient } from "@tanstack/react-query";

const LI_BLUE = "#0A66C2";

const LinkedInIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={LI_BLUE}>
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
);

const TypeBadge = ({ type }) => (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
        type === "person" ? "bg-blue-50 text-blue-700" : "bg-violet-50 text-violet-700"
    }`}>
        {type === "person" ? <UserCircle2 className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
        {type === "person" ? "Person" : "Company"}
    </span>
);

// Truncated text with full value on hover
const Truncated = ({ text, maxLen = 80 }) => {
    if (!text) return <span className="text-gray-300 text-xs">—</span>;
    const short = text.length > maxLen ? text.slice(0, maxLen) + "…" : text;
    return (
        <span className="text-xs text-gray-600 cursor-default" title={text}>
            {short}
        </span>
    );
};

const LinkedInLeads = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [query, setQuery] = useState("");
    const [type, setType] = useState("people");
    const [location, setLocation] = useState("");
    const [results, setResults] = useState([]);
    const [selected, setSelected] = useState(new Set());
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState("");
    const [importResult, setImportResult] = useState(null);
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        setError("");
        setResults([]);
        setSelected(new Set());
        setImportResult(null);
        setHasSearched(true);

        try {
            const res = await api.post("/linkedin-leads", {
                query: query.trim(),
                type,
                location: location.trim()
            });
            setResults(res.data.leads || []);
        } catch (err) {
            setError(err.response?.data?.error?.message || err.response?.data?.message || "Search failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const toggleSelect = (id) => {
        setSelected((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        setSelected(selected.size === results.length
            ? new Set()
            : new Set(results.map((r) => r.id))
        );
    };

    const handleImport = async () => {
        if (selected.size === 0) return;

        const leadsToImport = results
            .filter((r) => selected.has(r.id))
            .map(({ name, email, phone, jobTitle, company, biodata, linkedinUrl, enquiryType }) => ({
                name, email, phone, jobTitle, company, biodata, linkedinUrl, enquiryType
            }));

        setImporting(true);
        setImportResult(null);

        try {
            const res = await api.post("/linkedin-leads/import", { leads: leadsToImport });
            setImportResult({ success: true, ...res.data });
            setSelected(new Set());
            queryClient.invalidateQueries({ queryKey: ["leads"] });
        } catch (err) {
            setImportResult({
                success: false,
                message: err.response?.data?.error?.message || err.response?.data?.message || "Import failed. Please try again."
            });
        } finally {
            setImporting(false);
        }
    };

    const allSelected = results.length > 0 && selected.size === results.length;

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-blue-50 flex-shrink-0">
                    <LinkedInIcon size={22} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">LinkedIn Lead Search</h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        Search professionals and companies on LinkedIn — names, biodata, contact info imported directly to your leads dashboard.
                    </p>
                </div>
            </div>

            {/* Search Form */}
            <form onSubmit={handleSearch} className="bg-white border border-gray-200 rounded-xl p-4 mb-6 shadow-sm">
                <div className="flex gap-2 mb-4">
                    {[
                        { value: "people", label: "People", Icon: UserCircle2 },
                        { value: "companies", label: "Companies", Icon: Building2 }
                    ].map(({ value, label, Icon }) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => setType(value)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                type === value ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            }`}
                            style={type === value ? { backgroundColor: LI_BLUE } : {}}
                        >
                            <Icon className="h-4 w-4" />
                            {label}
                        </button>
                    ))}
                </div>

                <div className="flex gap-3">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={
                                type === "people"
                                    ? 'e.g. "Software Engineer", "Marketing Manager", "CEO"'
                                    : 'e.g. "Real Estate", "IT Services", "Healthcare"'
                            }
                            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    <div className="w-52 relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder="Location (optional)"
                            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !query.trim()}
                        className="px-5 py-2.5 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        style={{ backgroundColor: LI_BLUE }}
                    >
                        {loading ? (
                            <><Loader2 className="h-4 w-4 animate-spin" />Searching...</>
                        ) : (
                            <><Search className="h-4 w-4" />Search</>
                        )}
                    </button>
                </div>
            </form>

            {/* Error */}
            {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                    <X className="h-4 w-4 flex-shrink-0" />{error}
                </div>
            )}

            {/* Import Result Banner */}
            {importResult && (
                <div className={`mb-4 p-4 rounded-lg border text-sm flex items-center justify-between ${
                    importResult.success
                        ? "bg-green-50 border-green-200 text-green-800"
                        : "bg-red-50 border-red-200 text-red-700"
                }`}>
                    <span>{importResult.message}</span>
                    <div className="flex items-center gap-3">
                        {importResult.success && importResult.created > 0 && (
                            <button
                                onClick={() => navigate("/leads")}
                                className="flex items-center gap-1 font-medium underline hover:no-underline"
                            >
                                View in Leads <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                        )}
                        <button onClick={() => setImportResult(null)}>
                            <X className="h-4 w-4 opacity-60 hover:opacity-100" />
                        </button>
                    </div>
                </div>
            )}

            {/* Loading skeleton */}
            {loading && (
                <div className="space-y-3">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse">
                            <div className="flex items-center gap-4">
                                <div className="h-4 w-4 bg-gray-200 rounded" />
                                <div className="h-10 w-10 bg-gray-200 rounded-full" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-gray-200 rounded w-1/3" />
                                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                                </div>
                                <div className="h-3 bg-gray-100 rounded w-24" />
                                <div className="h-3 bg-gray-100 rounded w-32" />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Results */}
            {!loading && results.length > 0 && (
                <>
                    {/* Toolbar */}
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={toggleAll}
                                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                            >
                                {allSelected
                                    ? <CheckSquare className="h-4 w-4 text-blue-600" />
                                    : <Square className="h-4 w-4 text-gray-400" />}
                                {allSelected ? "Deselect all" : "Select all"}
                            </button>
                            <span className="text-sm text-gray-400">
                                {results.length} result{results.length !== 1 ? "s" : ""} found
                            </span>
                        </div>

                        {selected.size > 0 && (
                            <button
                                onClick={handleImport}
                                disabled={importing}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                            >
                                {importing
                                    ? <><Loader2 className="h-4 w-4 animate-spin" />Importing...</>
                                    : <><Users className="h-4 w-4" />Import {selected.size} Lead{selected.size !== 1 ? "s" : ""}</>}
                            </button>
                        )}
                    </div>

                    {/* Results Table */}
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="w-10 px-4 py-3" />
                                        <th className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">
                                            {type === "people" ? "Person" : "Company"}
                                        </th>
                                        {type === "people" && (
                                            <th className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">Title</th>
                                        )}
                                        <th className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">
                                            {type === "people" ? "Company" : "Industry"}
                                        </th>
                                        <th className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">Phone</th>
                                        <th className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">Email</th>
                                        <th className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">
                                            {type === "people" ? "Location" : "Followers"}
                                        </th>
                                        <th className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">Biodata</th>
                                        <th className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">Profile</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {results.map((lead) => {
                                        const isChecked = selected.has(lead.id);
                                        return (
                                            <tr
                                                key={lead.id}
                                                onClick={() => toggleSelect(lead.id)}
                                                className={`cursor-pointer transition-colors hover:bg-blue-50 ${isChecked ? "bg-blue-50" : ""}`}
                                            >
                                                {/* Checkbox */}
                                                <td className="px-4 py-3">
                                                    {isChecked
                                                        ? <CheckSquare className="h-4 w-4 text-blue-600" />
                                                        : <Square className="h-4 w-4 text-gray-300" />}
                                                </td>

                                                {/* Name */}
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-sm font-bold text-blue-700">
                                                            {lead.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="font-medium text-gray-900 whitespace-nowrap">{lead.name}</p>
                                                            {lead.connections && (
                                                                <p className="text-xs text-gray-400 flex items-center gap-1">
                                                                    <Wifi className="h-3 w-3" />{lead.connections} connections
                                                                </p>
                                                            )}
                                                            {lead.followers && (
                                                                <p className="text-xs text-gray-400 flex items-center gap-1">
                                                                    <Users className="h-3 w-3" />{lead.followers} followers
                                                                </p>
                                                            )}
                                                            <TypeBadge type={lead.type} />
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Job Title (people only) */}
                                                {type === "people" && (
                                                    <td className="px-4 py-3 max-w-[140px]">
                                                        {lead.jobTitle
                                                            ? <span className="flex items-center gap-1.5 text-gray-700 text-xs">
                                                                <Briefcase className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                                                                <span className="truncate">{lead.jobTitle}</span>
                                                              </span>
                                                            : <span className="text-gray-300 text-xs">—</span>}
                                                    </td>
                                                )}

                                                {/* Company / Industry */}
                                                <td className="px-4 py-3 max-w-[140px]">
                                                    {(lead.company || lead.industry)
                                                        ? <span className="flex items-center gap-1.5 text-gray-700 text-xs">
                                                            <Building2 className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                                                            <span className="truncate">{lead.company || lead.industry}</span>
                                                          </span>
                                                        : <span className="text-gray-300 text-xs">—</span>}
                                                </td>

                                                {/* Phone */}
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    {lead.phone
                                                        ? <span className="flex items-center gap-1.5 text-gray-700 text-xs">
                                                            <Phone className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                                                            {lead.phone}
                                                          </span>
                                                        : <span className="text-gray-300 text-xs">—</span>}
                                                </td>

                                                {/* Email */}
                                                <td className="px-4 py-3 max-w-[160px]">
                                                    {lead.email
                                                        ? <span className="flex items-center gap-1.5 text-gray-700 text-xs">
                                                            <Mail className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                                                            <span className="truncate" title={lead.email}>{lead.email}</span>
                                                          </span>
                                                        : <span className="text-gray-300 text-xs">—</span>}
                                                </td>

                                                {/* Location / Followers */}
                                                <td className="px-4 py-3 max-w-[140px]">
                                                    {type === "people"
                                                        ? lead.location
                                                            ? <span className="flex items-start gap-1.5 text-gray-600 text-xs">
                                                                <MapPin className="h-3.5 w-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                                                                <span className="truncate">{lead.location}</span>
                                                              </span>
                                                            : <span className="text-gray-300 text-xs">—</span>
                                                        : <span className="text-gray-300 text-xs">—</span>}
                                                </td>

                                                {/* Biodata */}
                                                <td className="px-4 py-3 max-w-[200px]">
                                                    {lead.biodata
                                                        ? <span className="flex items-start gap-1.5">
                                                            <FileText className="h-3.5 w-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                                                            <Truncated text={lead.biodata} maxLen={70} />
                                                          </span>
                                                        : <span className="text-gray-300 text-xs">—</span>}
                                                </td>

                                                {/* LinkedIn URL */}
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    {lead.linkedinUrl
                                                        ? <a
                                                            href={lead.linkedinUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="flex items-center gap-1.5 text-xs font-medium hover:underline"
                                                            style={{ color: LI_BLUE }}
                                                          >
                                                            <LinkedInIcon size={14} />
                                                            View Profile
                                                          </a>
                                                        : <span className="text-gray-300 text-xs">—</span>}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Bottom import bar */}
                    {selected.size > 0 && (
                        <div
                            className="mt-4 p-4 rounded-xl flex items-center justify-between text-white shadow-lg"
                            style={{ backgroundColor: LI_BLUE }}
                        >
                            <span className="text-sm font-medium">
                                {selected.size} lead{selected.size !== 1 ? "s" : ""} selected
                            </span>
                            <button
                                onClick={handleImport}
                                disabled={importing}
                                className="flex items-center gap-2 px-5 py-2 bg-white text-sm font-semibold rounded-lg hover:bg-blue-50 disabled:opacity-50 transition-colors"
                                style={{ color: LI_BLUE }}
                            >
                                {importing
                                    ? <><Loader2 className="h-4 w-4 animate-spin" />Importing...</>
                                    : <>Add to Leads Dashboard<ArrowRight className="h-4 w-4" /></>}
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* Empty state */}
            {!loading && hasSearched && results.length === 0 && !error && (
                <div className="text-center py-16">
                    <div className="mx-auto mb-4 opacity-20 w-fit"><LinkedInIcon size={48} /></div>
                    <p className="text-lg font-medium text-gray-500">No profiles found</p>
                    <p className="text-sm mt-1 text-gray-400">Try a different job title, company name, or location.</p>
                </div>
            )}

            {/* Initial state */}
            {!loading && !hasSearched && (
                <div className="text-center py-16">
                    <div className="mx-auto mb-4 opacity-20 w-fit"><LinkedInIcon size={48} /></div>
                    <p className="text-base font-medium text-gray-400">Search LinkedIn to find leads</p>
                    <p className="text-sm mt-1 text-gray-300">
                        Try: "Software Engineer" in Chennai · "Real Estate" in Mumbai
                    </p>
                </div>
            )}
        </div>
    );
};

export default LinkedInLeads;
