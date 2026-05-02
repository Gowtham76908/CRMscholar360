import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Building2, Phone, Mail, Globe, MapPin, Star, Loader2, CheckSquare, Square, Users, ArrowRight, X } from "lucide-react";
import api from "../api/axios";
import { useQueryClient } from "@tanstack/react-query";

const SearchLeads = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [query, setQuery] = useState("");
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
            const res = await api.post("/search-leads", { query: query.trim() });
            setResults(res.data.leads || []);
        } catch (err) {
            setError(err.response?.data?.message || "Search failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const toggleSelect = (id) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        const validResults = results.filter((r) => r.phone);
        if (selected.size === validResults.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(validResults.map((r) => r.id)));
        }
    };

    const handleImport = async () => {
        if (selected.size === 0) return;

        const leadsToImport = results
            .filter((r) => selected.has(r.id))
            .map(({ name, phone, email, source, enquiryType }) => ({
                name,
                phone,
                email,
                source,
                enquiryType
            }));

        setImporting(true);
        setImportResult(null);

        try {
            const res = await api.post("/search-leads/import", { leads: leadsToImport });
            setImportResult({ success: true, ...res.data });
            setSelected(new Set());
            // Invalidate leads cache so leads page refreshes
            queryClient.invalidateQueries({ queryKey: ["leads"] });
        } catch (err) {
            setImportResult({
                success: false,
                message: err.response?.data?.message || "Import failed. Please try again."
            });
        } finally {
            setImporting(false);
        }
    };

    const validResults = results.filter((r) => r.phone);
    const allSelected = validResults.length > 0 && selected.size === validResults.length;

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Search Leads</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Search for businesses online and instantly add them to your leads dashboard.
                </p>
            </div>

            {/* Search Form */}
            <form onSubmit={handleSearch} className="flex gap-3 mb-6">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder='e.g. "real estate companies in Coimbatore" or "IT companies in Chennai"'
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                </div>
                <button
                    type="submit"
                    disabled={loading || !query.trim()}
                    className="px-6 py-3 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                >
                    {loading ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Searching...
                        </>
                    ) : (
                        <>
                            <Search className="h-4 w-4" />
                            Search
                        </>
                    )}
                </button>
            </form>

            {/* Error */}
            {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                    <X className="h-4 w-4 flex-shrink-0" />
                    {error}
                </div>
            )}

            {/* Import Result Banner */}
            {importResult && (
                <div
                    className={`mb-4 p-4 rounded-lg border text-sm flex items-center justify-between ${
                        importResult.success
                            ? "bg-green-50 border-green-200 text-green-800"
                            : "bg-red-50 border-red-200 text-red-700"
                    }`}
                >
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
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse">
                            <div className="flex items-center gap-4">
                                <div className="h-4 w-4 bg-gray-200 rounded" />
                                <div className="h-10 w-10 bg-gray-200 rounded-lg" />
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
                                {allSelected ? (
                                    <CheckSquare className="h-4 w-4 text-indigo-600" />
                                ) : (
                                    <Square className="h-4 w-4 text-gray-400" />
                                )}
                                {allSelected ? "Deselect all" : "Select all"}
                            </button>
                            <span className="text-sm text-gray-400">
                                {results.length} result{results.length !== 1 ? "s" : ""} found
                                {validResults.length < results.length &&
                                    ` (${results.length - validResults.length} without phone number)`}
                            </span>
                        </div>

                        {selected.size > 0 && (
                            <button
                                onClick={handleImport}
                                disabled={importing}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {importing ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Importing...
                                    </>
                                ) : (
                                    <>
                                        <Users className="h-4 w-4" />
                                        Import {selected.size} Lead{selected.size !== 1 ? "s" : ""}
                                    </>
                                )}
                            </button>
                        )}
                    </div>

                    {/* Results Table */}
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="w-10 px-4 py-3" />
                                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Company</th>
                                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Phone</th>
                                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Email</th>
                                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Address</th>
                                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Rating</th>
                                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Website</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {results.map((lead) => {
                                    const isSelectable = !!lead.phone;
                                    const isChecked = selected.has(lead.id);

                                    return (
                                        <tr
                                            key={lead.id}
                                            onClick={() => isSelectable && toggleSelect(lead.id)}
                                            className={`transition-colors ${
                                                isSelectable
                                                    ? "cursor-pointer hover:bg-indigo-50"
                                                    : "opacity-50 cursor-not-allowed"
                                            } ${isChecked ? "bg-indigo-50" : ""}`}
                                        >
                                            {/* Checkbox */}
                                            <td className="px-4 py-3">
                                                {isSelectable ? (
                                                    isChecked ? (
                                                        <CheckSquare className="h-4 w-4 text-indigo-600" />
                                                    ) : (
                                                        <Square className="h-4 w-4 text-gray-300" />
                                                    )
                                                ) : (
                                                    <Square className="h-4 w-4 text-gray-200" />
                                                )}
                                            </td>

                                            {/* Company */}
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-9 w-9 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                                        <Building2 className="h-4 w-4 text-indigo-600" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-900">{lead.name}</p>
                                                        {lead.category && (
                                                            <p className="text-xs text-gray-400">{lead.category}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Phone */}
                                            <td className="px-4 py-3">
                                                {lead.phone ? (
                                                    <span className="flex items-center gap-1.5 text-gray-700">
                                                        <Phone className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                                                        {lead.phone}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-300 text-xs">Not available</span>
                                                )}
                                            </td>

                                            {/* Email */}
                                            <td className="px-4 py-3">
                                                {lead.email ? (
                                                    <span className="flex items-center gap-1.5 text-gray-700">
                                                        <Mail className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                                                        {lead.email}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-300 text-xs">—</span>
                                                )}
                                            </td>

                                            {/* Address */}
                                            <td className="px-4 py-3 max-w-xs">
                                                {lead.address ? (
                                                    <span className="flex items-start gap-1.5 text-gray-600 text-xs">
                                                        <MapPin className="h-3.5 w-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                                                        <span className="line-clamp-2">{lead.address}</span>
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-300 text-xs">—</span>
                                                )}
                                            </td>

                                            {/* Rating */}
                                            <td className="px-4 py-3">
                                                {lead.rating ? (
                                                    <span className="flex items-center gap-1 text-amber-600 text-xs font-medium">
                                                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                                                        {lead.rating}
                                                        {lead.ratingCount && (
                                                            <span className="text-gray-400 font-normal">
                                                                ({lead.ratingCount})
                                                            </span>
                                                        )}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-300 text-xs">—</span>
                                                )}
                                            </td>

                                            {/* Website */}
                                            <td className="px-4 py-3">
                                                {lead.website ? (
                                                    <a
                                                        href={lead.website}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 text-xs truncate max-w-[120px]"
                                                    >
                                                        <Globe className="h-3.5 w-3.5 flex-shrink-0" />
                                                        <span className="truncate">{lead.website.replace(/^https?:\/\//, "")}</span>
                                                    </a>
                                                ) : (
                                                    <span className="text-gray-300 text-xs">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Bottom import bar (sticky) */}
                    {selected.size > 0 && (
                        <div className="mt-4 p-4 bg-indigo-600 rounded-xl flex items-center justify-between text-white shadow-lg">
                            <span className="text-sm font-medium">
                                {selected.size} lead{selected.size !== 1 ? "s" : ""} selected
                            </span>
                            <button
                                onClick={handleImport}
                                disabled={importing}
                                className="flex items-center gap-2 px-5 py-2 bg-white text-indigo-700 text-sm font-semibold rounded-lg hover:bg-indigo-50 disabled:opacity-50 transition-colors"
                            >
                                {importing ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Importing...
                                    </>
                                ) : (
                                    <>
                                        Add to Leads Dashboard
                                        <ArrowRight className="h-4 w-4" />
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* Empty state */}
            {!loading && hasSearched && results.length === 0 && !error && (
                <div className="text-center py-16 text-gray-400">
                    <Search className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-lg font-medium text-gray-500">No results found</p>
                    <p className="text-sm mt-1">Try a different search term or location.</p>
                </div>
            )}

            {/* Initial state */}
            {!loading && !hasSearched && (
                <div className="text-center py-16 text-gray-400">
                    <Building2 className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p className="text-base font-medium text-gray-400">Search for businesses to find leads</p>
                    <p className="text-sm mt-1 text-gray-300">
                        Try: "real estate companies in Coimbatore" or "hospitals in Bangalore"
                    </p>
                </div>
            )}
        </div>
    );
};

export default SearchLeads;
