import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import api from "../api/axios";
import { Modal } from "./Modal";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const isSameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// Status → chip styling. Overdue (pending + past due) takes priority over plain pending.
const chipClass = (task, now) => {
    if (task.status === "COMPLETED") return "bg-green-50 text-green-700 border-green-200 line-through";
    if (new Date(task.dueDate) < now) return "bg-red-50 text-red-600 border-red-200";
    return "bg-indigo-50 text-indigo-700 border-indigo-200";
};

const MAX_CHIPS = 3;

const GROUPS = [
    { key: "overdue",   label: "Overdue",   dot: "bg-red-300" },
    { key: "pending",   label: "Pending",   dot: "bg-indigo-300" },
    { key: "completed", label: "Completed", dot: "bg-green-300" },
];

const TaskCalendar = () => {
    const [cursor, setCursor] = useState(() => {
        const t = new Date();
        return new Date(t.getFullYear(), t.getMonth(), 1);
    });
    const [selectedDay, setSelectedDay] = useState(null);

    const now = new Date();
    const year = cursor.getFullYear();
    const month = cursor.getMonth();

    // Visible grid spans the whole weeks containing this month — leading days from
    // the previous month and trailing days from the next, so we fetch that range.
    const gridStart = useMemo(() => {
        const first = new Date(year, month, 1);
        const d = new Date(first);
        d.setDate(1 - first.getDay());
        return d;
    }, [year, month]);

    const gridEnd = useMemo(() => {
        const last = new Date(year, month + 1, 0);
        const d = new Date(last);
        d.setDate(last.getDate() + (6 - last.getDay()));
        d.setHours(23, 59, 59, 999);
        return d;
    }, [year, month]);

    const days = useMemo(() => {
        const arr = [];
        for (let i = 0; i < 42; i++) {
            const d = new Date(gridStart);
            d.setDate(gridStart.getDate() + i);
            arr.push(d);
        }
        return arr;
    }, [gridStart]);

    const { data: tasks = [], isLoading } = useQuery({
        queryKey: ["tasks-calendar", ymd(gridStart), ymd(gridEnd)],
        queryFn: () =>
            api.get("/tasks/calendar", { params: { from: gridStart.toISOString(), to: gridEnd.toISOString() } })
                .then(r => r.data),
    });

    // Bucket tasks by their due day (yyyy-mm-dd) for O(1) cell lookups.
    const tasksByDay = useMemo(() => {
        const map = {};
        for (const t of tasks) {
            const key = ymd(new Date(t.dueDate));
            (map[key] ||= []).push(t);
        }
        return map;
    }, [tasks]);

    const goPrev = () => { setCursor(new Date(year, month - 1, 1)); setSelectedDay(null); };
    const goNext = () => { setCursor(new Date(year, month + 1, 1)); setSelectedDay(null); };
    const goToday = () => {
        const t = new Date();
        setCursor(new Date(t.getFullYear(), t.getMonth(), 1));
        setSelectedDay(null);
    };

    const selectedTasks = selectedDay ? (tasksByDay[ymd(selectedDay)] ?? []) : [];
    const grouped = { overdue: [], pending: [], completed: [] };
    for (const t of selectedTasks) {
        if (t.status === "COMPLETED") grouped.completed.push(t);
        else if (new Date(t.dueDate) < now) grouped.overdue.push(t);
        else grouped.pending.push(t);
    }

    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Calendar header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-gray-900">{MONTHS[month]} {year}</h2>
                    {isLoading && <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />}
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={goToday} className="px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                        Today
                    </button>
                    <button onClick={goPrev} className="p-1.5 text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50" title="Previous month">
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button onClick={goNext} className="p-1.5 text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50" title="Next month">
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Weekday labels */}
            <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50">
                {WEEKDAYS.map(d => (
                    <div key={d} className="px-2 py-2 text-center text-[11px] font-bold text-gray-400 uppercase tracking-wide">
                        {d}
                    </div>
                ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7">
                {days.map((day) => {
                    const inMonth = day.getMonth() === month;
                    const isToday = isSameDay(day, now);
                    const dayTasks = tasksByDay[ymd(day)] ?? [];
                    return (
                        <button
                            key={ymd(day)}
                            onClick={() => setSelectedDay(day)}
                            className={`min-h-[104px] text-left border-b border-r border-gray-100 p-1.5 flex flex-col gap-1 transition-colors
                                ${inMonth ? "bg-white hover:bg-gray-50" : "bg-gray-50/60"}`}
                        >
                            <span className={`text-xs font-semibold self-start px-1.5 py-0.5 rounded-full
                                ${isToday ? "bg-indigo-600 text-white" : inMonth ? "text-gray-700" : "text-gray-300"}`}>
                                {day.getDate()}
                            </span>
                            <div className="flex flex-col gap-1 overflow-hidden">
                                {dayTasks.slice(0, MAX_CHIPS).map(t => (
                                    <Link
                                        key={t.id}
                                        to={`/tasks/${t.id}`}
                                        state={{ from: "/tasks" }}
                                        onClick={e => e.stopPropagation()}
                                        title={t.title}
                                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded border truncate hover:opacity-80 ${chipClass(t, now)}`}
                                    >
                                        {t.title}
                                    </Link>
                                ))}
                                {dayTasks.length > MAX_CHIPS && (
                                    <span className="text-[10px] font-semibold text-gray-400 px-1.5">
                                        +{dayTasks.length - MAX_CHIPS} more
                                    </span>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Selected day dialog */}
            <Modal
                isOpen={!!selectedDay}
                onClose={() => setSelectedDay(null)}
                title={selectedDay
                    ? selectedDay.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
                    : ""}
            >
                {selectedTasks.length === 0 ? (
                    <p className="text-sm text-gray-400 py-2">No tasks due this day.</p>
                ) : (
                    <div className="space-y-5 max-h-[60vh] overflow-y-auto -mx-1 px-1">
                        {GROUPS.map(({ key, label, dot }) =>
                            grouped[key].length === 0 ? null : (
                                <div key={key}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`h-2.5 w-2.5 rounded-sm ${dot}`} />
                                        <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500">
                                            {label} <span className="text-gray-400">({grouped[key].length})</span>
                                        </h4>
                                    </div>
                                    <div className="space-y-2">
                                        {grouped[key].map(t => (
                                            <Link
                                                key={t.id}
                                                to={`/tasks/${t.id}`}
                                                state={{ from: "/tasks" }}
                                                onClick={() => setSelectedDay(null)}
                                                className={`block px-3 py-2 rounded-lg border hover:shadow-sm transition-all ${chipClass(t, now)}`}
                                            >
                                                <p className={`text-sm font-semibold truncate ${t.status === "COMPLETED" ? "line-through" : ""}`}>
                                                    {t.title}
                                                </p>
                                                <p className="text-[11px] opacity-80 mt-0.5">
                                                    {t.assignedTo?.name || "Unassigned"}
                                                    {t.lead && <span> · {t.lead.name}</span>}
                                                </p>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )
                        )}
                    </div>
                )}
            </Modal>

            {/* Legend */}
            <div className="flex items-center gap-4 px-5 py-3 border-t border-gray-100 text-[11px] text-gray-500">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-indigo-200 border border-indigo-300" /> Pending</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-red-200 border border-red-300" /> Overdue</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-green-200 border border-green-300" /> Completed</span>
            </div>
        </div>
    );
};

export default TaskCalendar;
