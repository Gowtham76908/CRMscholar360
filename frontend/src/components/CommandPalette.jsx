import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { cn } from "../lib/utils";
import api from "../api/axios";
import {
    Search, LayoutDashboard, Users, CheckSquare, BarChart,
    Settings, Bot, Send, ArrowRight,
    User, Receipt, Clock, Calendar, Building, MessageSquare, Inbox,
} from "lucide-react";

const NAV_COMMANDS = [
    { id: "nav-dashboard",   label: "Go to Dashboard",    path: "/dashboard",          icon: LayoutDashboard, group: "Navigation" },
    { id: "nav-leads",       label: "Go to Leads",        path: "/leads",              icon: Users,           group: "Navigation" },
    { id: "nav-tasks",       label: "Go to Tasks",        path: "/tasks",              icon: CheckSquare,     group: "Navigation" },
    { id: "nav-inbox",       label: "Go to Inbox",        path: "/inbox",              icon: Inbox,           group: "Navigation" },
    { id: "nav-messages",    label: "Go to Messages",     path: "/messages",           icon: MessageSquare,   group: "Navigation" },
    { id: "nav-reports",     label: "Go to Reports",      path: "/reports",            icon: BarChart,        group: "Navigation" },
    { id: "nav-attendance",  label: "Go to Attendance",   path: "/attendance",         icon: Clock,           group: "Navigation" },
    { id: "nav-leave",       label: "Go to Leave",        path: "/leave",              icon: Calendar,        group: "Navigation" },
    { id: "nav-dept-queue",  label: "Go to Department Queue", path: "/department-queue", icon: Building,        group: "Navigation" },
    { id: "nav-automations", label: "Go to Automations",  path: "/automations",        icon: Bot,             group: "Navigation" },
    { id: "nav-campaigns",   label: "Go to WA Campaigns", path: "/whatsapp/campaigns", icon: Send,            group: "Navigation" },
    { id: "nav-invoices",    label: "Go to Invoices",     path: "/invoices",           icon: Receipt,         group: "Navigation" },
    { id: "nav-settings",    label: "Go to Settings",     path: "/settings",           icon: Settings,        group: "Navigation" },
];

function fuzzy(haystack, needle) {
    if (!needle) return true;
    const h = haystack.toLowerCase();
    const n = needle.toLowerCase();
    let hi = 0;
    for (let ni = 0; ni < n.length; ni++) {
        const idx = h.indexOf(n[ni], hi);
        if (idx === -1) return false;
        hi = idx + 1;
    }
    return true;
}

export default function CommandPalette() {
    const [open, setOpen]     = useState(false);
    const [query, setQuery]   = useState("");
    const [cursor, setCursor] = useState(0);
    const inputRef  = useRef(null);
    const listRef   = useRef(null);
    const navigate  = useNavigate();

    useEffect(() => {
        const handle = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "k") {
                e.preventDefault();
                setOpen(v => !v);
                setQuery("");
                setCursor(0);
            }
            if (e.key === "Escape") setOpen(false);
        };
        window.addEventListener("keydown", handle);
        return () => window.removeEventListener("keydown", handle);
    }, []);

    useEffect(() => {
        if (open) setTimeout(() => inputRef.current?.focus(), 10);
    }, [open]);

    const enabled = open && query.trim().length >= 2;

    const { data: leadResults = [] } = useQuery({
        queryKey: ["cmd-leads", query],
        queryFn: () => api.get("/leads", { params: { search: query, limit: 5 } })
            .then(r => (r.data.data || r.data).slice(0, 5)),
        enabled,
        staleTime: 10_000,
    });

    const { data: allTasks = [] } = useQuery({
        queryKey: ["cmd-tasks-all"],
        queryFn: () => api.get("/tasks").then(r => r.data.data || r.data || []),
        enabled: open,
        staleTime: 60_000,
    });

    const { data: allUsers = [] } = useQuery({
        queryKey: ["cmd-users-all"],
        queryFn: () => api.get("/team").then(r => r.data.members || r.data || []),
        enabled: open,
        staleTime: 60_000,
    });

    const taskResults = useMemo(() => {
        if (query.trim().length < 2) return [];
        const q = query.toLowerCase();
        return allTasks.filter(t => (t.title || t.name || "").toLowerCase().includes(q)).slice(0, 4);
    }, [allTasks, query]);

    const userResults = useMemo(() => {
        if (query.trim().length < 2) return [];
        const q = query.toLowerCase();
        return allUsers.filter(u => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)).slice(0, 4);
    }, [allUsers, query]);

    const leadCommands = leadResults.map(l => ({
        id: `lead-${l.id}`,
        label: l.name,
        sub: l.phone || l.email || "",
        path: `/leads/${l.id}`,
        icon: User,
        group: "Leads",
    }));

    const taskCommands = taskResults.map(t => ({
        id: `task-${t.id}`,
        label: t.title || t.name || "Untitled task",
        sub: t.status || "",
        path: `/tasks/${t.id}`,
        icon: CheckSquare,
        group: "Tasks",
    }));

    const userCommands = userResults.map(u => ({
        id: `user-${u.id}`,
        label: u.name,
        sub: u.email || u.role || "",
        path: `/team`,
        icon: Users,
        group: "Team",
    }));

    const filtered = useMemo(() => {
        const navFiltered = NAV_COMMANDS.filter(c => fuzzy(c.label, query));
        if (query.trim().length >= 2) {
            return [...leadCommands, ...taskCommands, ...userCommands, ...navFiltered];
        }
        return navFiltered;
    }, [query, leadCommands, taskCommands, userCommands]); // eslint-disable-line

    useEffect(() => { setCursor(0); }, [filtered.length, query]);

    const handleKeyDown = (e) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setCursor(c => Math.min(c + 1, filtered.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setCursor(c => Math.max(c - 1, 0));
        } else if (e.key === "Enter" && filtered[cursor]) {
            runCommand(filtered[cursor]);
        }
    };

    const runCommand = (cmd) => {
        setOpen(false);
        setQuery("");
        navigate(cmd.path);
    };

    useEffect(() => {
        const el = listRef.current?.children[cursor];
        el?.scrollIntoView({ block: "nearest" });
    }, [cursor]);

    const groups = useMemo(() => {
        const map = new Map();
        filtered.forEach(cmd => {
            if (!map.has(cmd.group)) map.set(cmd.group, []);
            map.get(cmd.group).push(cmd);
        });
        return map;
    }, [filtered]);

    if (!open) return null;

    const flat = filtered;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4"
            aria-modal="true"
            role="dialog"
        >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />

            <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
                    <Search className="h-4 w-4 text-gray-400 shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Search leads, tasks, team or navigate..."
                        className="flex-1 text-sm text-gray-900 placeholder-gray-400 bg-transparent outline-none"
                    />
                    <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-gray-200 bg-gray-50 px-1.5 text-[10px] font-medium text-gray-500">
                        ESC
                    </kbd>
                </div>

                <div ref={listRef} className="max-h-80 overflow-y-auto py-2">
                    {filtered.length === 0 && (
                        <p className="text-sm text-gray-400 text-center py-8">No results</p>
                    )}
                    {[...groups.entries()].map(([groupLabel, items]) => (
                        <div key={groupLabel}>
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-4 py-1.5">
                                {groupLabel}
                            </p>
                            {items.map((cmd) => {
                                const idx = flat.indexOf(cmd);
                                const active = idx === cursor;
                                return (
                                    <button
                                        key={cmd.id}
                                        onClick={() => runCommand(cmd)}
                                        onMouseEnter={() => setCursor(idx)}
                                        className={cn(
                                            "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                                            active ? "bg-orange-50" : "hover:bg-gray-50"
                                        )}
                                    >
                                        <div className={cn(
                                            "h-7 w-7 rounded-lg flex items-center justify-center shrink-0",
                                            active ? "bg-orange-100" : "bg-gray-100"
                                        )}>
                                            <cmd.icon className={cn("h-3.5 w-3.5", active ? "text-orange-600" : "text-gray-500")} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={cn("text-sm font-medium truncate", active ? "text-orange-700" : "text-gray-900")}>
                                                {cmd.label}
                                            </p>
                                            {cmd.sub && (
                                                <p className="text-xs text-gray-400 truncate">{cmd.sub}</p>
                                            )}
                                        </div>
                                        {active && <ArrowRight className="h-3.5 w-3.5 text-orange-400 shrink-0" />}
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </div>

                <div className="flex items-center gap-3 px-4 py-2.5 border-t border-gray-100 bg-gray-50">
                    <span className="text-[10px] text-gray-400"><kbd className="font-medium">↑↓</kbd> navigate</span>
                    <span className="text-[10px] text-gray-400"><kbd className="font-medium">Enter</kbd> open</span>
                    <span className="text-[10px] text-gray-400"><kbd className="font-medium">Esc</kbd> close</span>
                </div>
            </div>
        </div>
    );
}
