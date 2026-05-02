import { useState, useEffect, useRef } from "react";
import { Search, Loader2, User, CheckSquare, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

const GlobalSearch = () => {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const searchRef = useRef(null);
    const navigate = useNavigate();

    // Debounce Search
    useEffect(() => {
        const timeoutId = setTimeout(async () => {
            if (query.length >= 2) {
                setLoading(true);
                setIsOpen(true);
                try {
                    const res = await api.get(`/search?q=${query}`);
                    setResults(res.data);
                } catch (error) {
                    console.error("Search failed:", error);
                } finally {
                    setLoading(false);
                }
            } else {
                setResults(null);
                setIsOpen(false);
            }
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [query]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleNavigate = (path) => {
        setIsOpen(false);
        setQuery("");
        navigate(path);
    };

    return (
        <div className="relative w-full max-w-sm" ref={searchRef}>
            <div className="flex items-center w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all">
                {loading ? <Loader2 className="h-4 w-4 animate-spin text-indigo-500 mr-2" /> : <Search className="h-4 w-4 text-gray-400 mr-2" />}
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search leads, tasks, users..."
                    className="bg-transparent border-none focus:ring-0 text-sm w-full placeholder-gray-400 text-gray-900 outline-none"
                    onFocus={() => { if (query.length >= 2) setIsOpen(true); }}
                />
            </div>

            {isOpen && results && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-100 max-h-96 overflow-y-auto z-50">
                    {/* Leads */}
                    {results.leads?.length > 0 && (
                        <div className="p-2">
                            <h4 className="text-xs font-semibold text-gray-500 px-2 mb-1 flex items-center gap-1">
                                <User className="h-3 w-3" /> LEADS
                            </h4>
                            {results.leads.map(lead => (
                                <div
                                    key={lead.id}
                                    onClick={() => handleNavigate("/leads")} // Ideally deep link /leads?id=...
                                    className="px-2 py-2 hover:bg-gray-50 rounded cursor-pointer text-sm"
                                >
                                    <div className="font-medium text-gray-900">{lead.name}</div>
                                    <div className="text-xs text-gray-500">{lead.email || lead.phone}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Tasks */}
                    {results.tasks?.length > 0 && (
                        <div className="p-2 border-t border-gray-100">
                            <h4 className="text-xs font-semibold text-gray-500 px-2 mb-1 flex items-center gap-1">
                                <CheckSquare className="h-3 w-3" /> TASKS
                            </h4>
                            {results.tasks.map(task => (
                                <div
                                    key={task.id}
                                    onClick={() => handleNavigate("/tasks")}
                                    className="px-2 py-2 hover:bg-gray-50 rounded cursor-pointer text-sm"
                                >
                                    <div className="font-medium text-gray-900">{task.title}</div>
                                    <div className="text-xs text-gray-500">{task.status}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Users */}
                    {results.users?.length > 0 && (
                        <div className="p-2 border-t border-gray-100">
                            <h4 className="text-xs font-semibold text-gray-500 px-2 mb-1 flex items-center gap-1">
                                <Users className="h-3 w-3" /> TEAM
                            </h4>
                            {results.users.map(user => (
                                <div
                                    key={user.id}
                                    onClick={() => handleNavigate("/team")}
                                    className="px-2 py-2 hover:bg-gray-50 rounded cursor-pointer text-sm"
                                >
                                    <div className="font-medium text-gray-900">{user.name}</div>
                                    <div className="text-xs text-gray-500">{user.department || user.role}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* No Results */}
                    {(!results.leads?.length && !results.tasks?.length && !results.users?.length) && (
                        <div className="p-4 text-center text-sm text-gray-500">
                            No results found.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default GlobalSearch;
