import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import {
    Clock, CheckCircle, XCircle, Calendar, MapPin, Loader2,
    ChevronLeft, ChevronRight, Users, CalendarDays,
    Home, UserX, Timer, LogIn, LogOut, ArrowRight, Search,
} from "lucide-react";

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const generateMonthDays = (year, month) => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const today = new Date();
    const days = [];
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month - 1, d);
        days.push({
            d, date,
            dateStr: `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
            dayName: date.toLocaleDateString("en-US", { weekday: "short" }),
            isSunday: date.getDay() === 0,
            isToday: date.toDateString() === today.toDateString(),
            isPast: date < today && date.toDateString() !== today.toDateString()
        });
    }
    return days;
};

const StatusBadge = ({ status }) => {
    const map = {
        PRESENT:  { bg: "bg-green-100 text-green-700",   label: "Present"  },
        ABSENT:   { bg: "bg-red-100 text-red-700",       label: "Absent"   },
        LEAVE:    { bg: "bg-blue-100 text-blue-700",     label: "Leave"    },
        WFH:      { bg: "bg-purple-100 text-purple-700", label: "WFH"      },
        HALF_DAY: { bg: "bg-yellow-100 text-yellow-700", label: "Half Day" },
        COMP_OFF: { bg: "bg-indigo-100 text-indigo-700", label: "Comp Off" },
    };
    const s = map[status] || { bg: "bg-gray-100 text-gray-500", label: status };
    return (
        <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${s.bg}`}>{s.label}</span>
    );
};

// ─── Month/Year Picker Modal ───────────────────────────────────────────────────

const MonthYearPicker = ({ isOpen, onClose, currentMonth, currentYear, onSelect }) => {
    if (!isOpen) return null;
    const years = [];
    const thisYear = new Date().getFullYear();
    for (let y = thisYear - 2; y <= thisYear + 1; y++) years.push(y);

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-gray-900 flex-1 text-center">Select Month & Year</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100">
                        <XCircle className="h-5 w-5" />
                    </button>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-6">
                    {MONTHS.map((m, idx) => (
                        <button
                            key={m}
                            onClick={() => onSelect(idx + 1, currentYear)}
                            className={`py-2 text-xs font-semibold rounded-lg transition ${currentMonth === idx + 1 ? "bg-indigo-600 text-white shadow" : "bg-gray-50 text-gray-700 hover:bg-gray-100"}`}
                        >
                            {m.slice(0, 3)}
                        </button>
                    ))}
                </div>
                <div className="flex justify-center flex-wrap gap-2">
                    {years.map(y => (
                        <button
                            key={y}
                            onClick={() => onSelect(currentMonth, y)}
                            className={`px-4 py-2 text-sm font-bold rounded-xl transition ${currentYear === y ? "bg-indigo-600 text-white shadow" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                        >
                            {y}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

// ─── My Historical Logs Panel ──────────────────────────────────────────────────

const MyLogsPanel = () => {
    const today = new Date();
    const [month, setMonth] = useState(today.getMonth() + 1);
    const [year, setYear] = useState(today.getFullYear());
    const [showPicker, setShowPicker] = useState(false);

    const { data: records = [], isLoading } = useQuery({
        queryKey: ["my-attendance-history", month, year],
        queryFn: async () => (await api.get(`/attendance/my?month=${month}&year=${year}`)).data
    });

    const days = generateMonthDays(year, month);
    const recordMap = {};
    records.forEach(r => {
        const d = new Date(r.date);
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
        recordMap[key] = r;
    });

    const formatTime = (dt) => new Date(dt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const isNextDisabled = year > today.getFullYear() || (year === today.getFullYear() && month >= today.getMonth() + 1);

    const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
    const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">My Log</h2>
                    <p className="text-gray-500 text-sm">Monthly attendance summary</p>
                </div>
                <div className="flex items-center gap-2 bg-white rounded-xl shadow-sm px-2 py-1.5 border border-[#E4E4E7]">
                    <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded-lg">
                        <ChevronLeft className="h-4 w-4 text-gray-600" />
                    </button>
                    <button onClick={() => setShowPicker(true)} className="font-semibold text-gray-900 min-w-[130px] text-center hover:bg-indigo-50 px-2 py-1 rounded-lg transition text-sm">
                        {MONTHS[month - 1]} {year}
                    </button>
                    <button onClick={nextMonth} disabled={isNextDisabled} className="p-1 hover:bg-gray-100 rounded-lg disabled:opacity-30">
                        <ChevronRight className="h-4 w-4 text-gray-600" />
                    </button>
                </div>
            </div>

            <MonthYearPicker isOpen={showPicker} onClose={() => setShowPicker(false)} currentMonth={month} currentYear={year}
                onSelect={(m, y) => { setMonth(m); setYear(y); setShowPicker(false); }} />

            <div className="bg-white rounded-2xl border border-[#E4E4E7] overflow-hidden shadow-sm">
                {isLoading ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-indigo-600" /></div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-indigo-50/50 border-b border-[#E4E4E7]">
                                    {["Date", "Day", "Check In", "Check Out", "Hours", "Status"].map(h => (
                                        <th key={h} className="px-6 py-3.5 text-left text-xs font-semibold text-[#71717A] uppercase tracking-wider">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E4E4E7]">
                                {days.map((day) => {
                                    const rec = recordMap[day.dateStr];
                                    const hours = rec?.checkIn && rec?.checkOut
                                        ? ((new Date(rec.checkOut) - new Date(rec.checkIn)) / 36e5).toFixed(1) : null;

                                    if (day.isSunday) return (
                                        <tr key={day.d} className="bg-indigo-50/20">
                                            <td className="px-6 py-3 font-medium text-indigo-700">{String(day.d).padStart(2, "0")} {MONTHS[month - 1].slice(0, 3)}</td>
                                            <td className="px-6 py-3 text-indigo-600">{day.dayName}</td>
                                            <td colSpan="3" className="px-6 py-3 text-indigo-400 text-xs italic">— Weekly Holiday —</td>
                                            <td className="px-6 py-3"><span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-indigo-100 text-indigo-700">Holiday</span></td>
                                        </tr>
                                    );

                                    return (
                                        <tr key={day.d} className={`transition-colors ${day.isToday ? "bg-indigo-50/30" : "hover:bg-gray-50/60"}`}>
                                            <td className="px-6 py-3 font-medium text-[#18181B]">{String(day.d).padStart(2, "0")} {MONTHS[month - 1].slice(0, 3)}</td>
                                            <td className="px-6 py-3 text-[#71717A] font-medium">{day.dayName}</td>
                                            <td className="px-6 py-3 text-[#71717A]">{rec?.checkIn ? formatTime(rec.checkIn) : <span className="text-gray-300">—</span>}</td>
                                            <td className="px-6 py-3 text-[#71717A]">{rec?.checkOut ? formatTime(rec.checkOut) : <span className="text-gray-300">—</span>}</td>
                                            <td className="px-6 py-3 text-[#71717A]">{hours ? <span className="font-semibold text-[#18181B]">{hours} hrs</span> : <span className="text-gray-300">—</span>}</td>
                                            <td className="px-6 py-3">{rec ? <StatusBadge status={rec.status} /> : <span className="text-gray-300 text-xs">—</span>}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Check-In Dashboard Panel ──────────────────────────────────────────────────

const CheckInPanel = () => {
    const queryClient = useQueryClient();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [isGettingLocation, setIsGettingLocation] = useState(false);
    const [workDuration, setWorkDuration] = useState("00h 00m 00s");

    const isCheckInAllowed = () => {
        const t = currentTime;
        return (t.getHours() * 60 + t.getMinutes()) <= (11 * 60 + 50);
    };

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const { data: attendanceToday } = useQuery({
        queryKey: ["attendance-today"],
        queryFn: async () => {
            const res = await api.get("/attendance/my?limit=1");
            const today = new Date().toDateString();
            return res.data.find(a => new Date(a.date).toDateString() === today) || null;
        },
        refetchInterval: 60000
    });

    // Live work duration
    useEffect(() => {
        if (!attendanceToday?.checkIn || attendanceToday?.checkOut) return;
        const update = () => {
            const diff = Date.now() - new Date(attendanceToday.checkIn).getTime();
            const h = Math.floor(diff / 36e5);
            const m = Math.floor((diff % 36e5) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setWorkDuration(`${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`);
        };
        update();
        const t = setInterval(update, 1000);
        return () => clearInterval(t);
    }, [attendanceToday]);

    const { data: stats } = useQuery({
        queryKey: ["attendance-stats"],
        queryFn: async () => (await api.get("/attendance/stats")).data
    });

    const { data: statusLogs = [] } = useQuery({
        queryKey: ["status-logs-today"],
        queryFn: async () => (await api.get("/user-status/me/logs-today")).data,
        refetchInterval: 60000
    });

    const { data: history = [] } = useQuery({
        queryKey: ["attendance-history"],
        queryFn: async () => (await api.get("/attendance/my")).data
    });

    const checkInMutation = useMutation({
        mutationFn: (locationData) => api.post("/attendance/check-in", locationData),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
            queryClient.invalidateQueries({ queryKey: ["attendance-history"] });
            queryClient.invalidateQueries({ queryKey: ["attendance-stats"] });
            toast.success("Checked in successfully!");
        },
        onError: (error) => {
            const d = error.response?.data;
            if (d?.code === "LATE_CHECK_IN") {
                toast.error(`Late check-in: ${d.message}. Deadline was ${d.deadline}.`);
            } else {
                toast.error(d?.message || "Failed to check in");
            }
        }
    });

    const checkOutMutation = useMutation({
        mutationFn: () => api.post("/attendance/check-out"),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
            queryClient.invalidateQueries({ queryKey: ["attendance-history"] });
            queryClient.invalidateQueries({ queryKey: ["attendance-stats"] });
            toast.success("Checked out successfully!");
        },
        onError: (error) => toast.error(error.response?.data?.message || "Failed to check out")
    });

    const handleCheckIn = () => {
        setIsGettingLocation(true);
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    setIsGettingLocation(false);
                    checkInMutation.mutate({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
                },
                () => { setIsGettingLocation(false); checkInMutation.mutate({}); },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        } else {
            setIsGettingLocation(false);
            checkInMutation.mutate({});
        }
    };

    const formatTime = (dt) => new Date(dt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const formatDateShort = (dt) => new Date(dt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

    const checkedIn  = !!attendanceToday?.checkIn;
    const checkedOut = !!attendanceToday?.checkOut;
    const isPending  = isGettingLocation || checkInMutation.isPending;

    const metricCards = [
        { label: "Total Days", value: stats?.total || 0, sub: "This Month",    icon: CalendarDays, color: "text-gray-700", iconBg: "bg-gray-100" },
        { label: "Present",    value: stats?.present || 0, sub: "This Month",  icon: CheckCircle,  color: "text-green-600", iconBg: "bg-green-50" },
        { label: "WFH",        value: stats?.wfh || 0,    sub: "This Month",   icon: Home,         color: "text-purple-600", iconBg: "bg-purple-50" },
        { label: "Absent",     value: stats?.absent || 0, sub: "This Month",   icon: UserX,        color: "text-red-500", iconBg: "bg-red-50" },
        { label: "Comp Off",   value: stats?.compOffBalance || 0, sub: "Sundays worked", icon: Timer, color: "text-indigo-600", iconBg: "bg-indigo-50" },
    ];

    const timelineColorMap = {
        ONLINE:  { dot: "bg-green-500",  ring: "ring-green-200",  label: "Checked In",    textColor: "text-green-600" },
        BREAK:   { dot: "bg-yellow-500", ring: "ring-yellow-200", label: "On Break",      textColor: "text-yellow-600" },
        OFFLINE: { dot: "bg-gray-400",   ring: "ring-gray-200",   label: "Offline",       textColor: "text-gray-500" },
    };

    return (
        <div className="space-y-6">

            {/* ── Section 1: Hero grid ─────────────────────────────────────── */}
            <div className="flex flex-col gap-4">

                {/* Left: Today's Status card */}
                <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-5 text-white shadow-lg shadow-indigo-100 flex flex-col justify-between">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-indigo-100 text-[10px] font-semibold uppercase tracking-widest mb-1">Today's Status</p>
                            <h2 className="text-xl font-bold leading-tight">
                                {checkedOut ? "Day Complete" : checkedIn ? "Checked In" : "Not Checked In"}
                            </h2>
                            {checkedIn && (
                                <p className="text-indigo-100 text-xs mt-0.5">
                                    {formatTime(attendanceToday.checkIn)}
                                    {attendanceToday?.checkOut && ` → ${formatTime(attendanceToday.checkOut)}`}
                                </p>
                            )}
                            {attendanceToday?.location?.latitude && (
                                <a
                                    href={`https://www.google.com/maps?q=${attendanceToday.location.latitude},${attendanceToday.location.longitude}`}
                                    target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-indigo-200 hover:text-white text-xs mt-1 transition"
                                >
                                    <MapPin className="h-3 w-3" /> Location recorded · View on map
                                </a>
                            )}
                        </div>
                        <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${checkedIn && !checkedOut ? "bg-white/20" : "bg-white/10"}`}>
                            {checkedOut ? <CheckCircle className="h-4.5 w-4.5 text-white" /> : <Clock className="h-4 w-4 text-white" />}
                        </div>
                    </div>
                    <div className="flex items-center gap-3 mt-4">
                        {!checkedIn && (
                            <button
                                onClick={handleCheckIn}
                                disabled={isPending || !isCheckInAllowed()}
                                className="flex items-center gap-2 bg-white text-indigo-600 px-4 py-2 rounded-xl font-semibold text-sm hover:bg-indigo-50 transition shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                                {isGettingLocation ? "Getting location…" : checkInMutation.isPending ? "Checking in…" : !isCheckInAllowed() ? "Check-in Closed" : "Check In"}
                            </button>
                        )}
                        {checkedIn && !checkedOut && (
                            <button
                                onClick={() => checkOutMutation.mutate()}
                                disabled={checkOutMutation.isPending}
                                className="flex items-center gap-2 bg-white text-indigo-600 px-4 py-2 rounded-xl font-semibold text-sm hover:bg-indigo-50 transition shadow-sm active:scale-95 disabled:opacity-50"
                            >
                                {checkOutMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                                {checkOutMutation.isPending ? "Checking out…" : "Check Out"}
                            </button>
                        )}
                        {checkedIn && !checkedOut && (
                            <span className="text-indigo-100 text-xs font-mono">{workDuration}</span>
                        )}
                        {!isCheckInAllowed() && !checkedIn && (
                            <p className="text-indigo-200 text-xs">⚠ Deadline passed · Contact HR</p>
                        )}
                    </div>
                </div>

                {/* Right: Metric cards */}
                <div className="grid grid-cols-5 lg:grid-cols-5 gap-3 lg:col-span-full">
                    {metricCards.map(card => (
                        <div key={card.label} className="bg-white rounded-2xl border border-[#E4E4E7] p-4 flex flex-col gap-2 hover:shadow-md hover:scale-[1.02] transition-all duration-200">
                            <div className={`h-8 w-8 rounded-lg ${card.iconBg} flex items-center justify-center`}>
                                <card.icon className={`h-4 w-4 ${card.color}`} />
                            </div>
                            <div>
                                <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
                                <p className="text-[10px] text-[#71717A] uppercase tracking-wide font-semibold">{card.label}</p>
                                <p className="text-[10px] text-[#71717A]">{card.sub}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Section 2: Action widget + Timeline ─────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Left: Circular action widget */}
                <div className="bg-white rounded-2xl border border-[#E4E4E7] p-6 flex flex-col items-center justify-center gap-5 shadow-sm">
                    <div className="text-center">
                        <p className="text-[#18181B] font-semibold">
                            {checkedOut ? "Day Complete" : checkedIn ? (
                                <span>You are <span className="text-green-500 font-bold">checked in</span></span>
                            ) : "You are not checked in"}
                        </p>
                        {checkedIn && !checkedOut && (
                            <p className="text-[#71717A] text-sm mt-0.5 flex items-center justify-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
                                Since {formatTime(attendanceToday.checkIn)}
                            </p>
                        )}
                    </div>

                    {/* Big circular button */}
                    <div className="relative">
                        <div className="absolute inset-0 rounded-full bg-indigo-100 animate-ping opacity-20" style={{ animationDuration: "2.5s" }} />
                        {!checkedIn ? (
                            <button
                                onClick={handleCheckIn}
                                disabled={isPending || !isCheckInAllowed()}
                                className="relative h-32 w-32 rounded-full bg-gradient-to-br from-indigo-600 to-violet-700 text-white font-bold text-base flex flex-col items-center justify-center gap-1 shadow-xl shadow-indigo-100/50 hover:shadow-indigo-200/60 hover:scale-105 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isPending ? <Loader2 className="h-7 w-7 animate-spin" /> : <LogIn className="h-7 w-7" />}
                                <span className="text-sm">{isGettingLocation ? "Locating…" : checkInMutation.isPending ? "Checking in…" : !isCheckInAllowed() ? "Closed" : "Check In"}</span>
                            </button>
                        ) : !checkedOut ? (
                            <button
                                onClick={() => checkOutMutation.mutate()}
                                disabled={checkOutMutation.isPending}
                                className="relative h-32 w-32 rounded-full bg-gradient-to-br from-indigo-600 to-violet-700 text-white font-bold text-base flex flex-col items-center justify-center gap-1 shadow-xl shadow-indigo-100/50 hover:shadow-indigo-200/60 hover:scale-105 active:scale-95 transition-all duration-200 disabled:opacity-50"
                            >
                                {checkOutMutation.isPending ? <Loader2 className="h-7 w-7 animate-spin" /> : <LogOut className="h-7 w-7" />}
                                <span className="text-sm">{checkOutMutation.isPending ? "Checking out…" : "Check Out"}</span>
                            </button>
                        ) : (
                            <div className="h-32 w-32 rounded-full bg-green-50 border-4 border-green-200 flex flex-col items-center justify-center gap-1 shadow-md">
                                <CheckCircle className="h-8 w-8 text-green-500" />
                                <span className="text-sm font-semibold text-green-600">Done</span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-6 text-center w-full px-4">
                        <div className="flex-1">
                            <div className="flex items-center justify-center gap-1 text-[#71717A] mb-0.5">
                                <MapPin className="h-3.5 w-3.5" />
                                <span className="text-xs">Location</span>
                            </div>
                            <p className="text-sm font-semibold text-[#18181B]">
                                {attendanceToday?.location?.latitude ? "Recorded" : "—"}
                            </p>
                        </div>
                        <div className="w-px h-8 bg-[#E4E4E7]" />
                        <div className="flex-1">
                            <div className="flex items-center justify-center gap-1 text-[#71717A] mb-0.5">
                                <Timer className="h-3.5 w-3.5" />
                                <span className="text-xs">Working</span>
                            </div>
                            <p className="text-sm font-semibold text-[#18181B] font-mono">
                                {checkedIn && !checkedOut ? workDuration : checkedOut ? (() => {
                                    const diff = new Date(attendanceToday.checkOut) - new Date(attendanceToday.checkIn);
                                    const h = Math.floor(diff / 36e5);
                                    const m = Math.floor((diff % 36e5) / 60000);
                                    return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
                                })() : "—"}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Right: Activity Timeline */}
                <div className="bg-white rounded-2xl border border-[#E4E4E7] p-6 shadow-sm">
                    <h3 className="font-semibold text-[#18181B] mb-4">Today's Activity Timeline</h3>
                    {statusLogs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-[#71717A]">
                            <Clock className="h-8 w-8 mb-2 opacity-30" />
                            <p className="text-sm">No activity yet today</p>
                        </div>
                    ) : (
                        <div className="relative">
                            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-[#E4E4E7]" />
                            <div className="space-y-4">
                                {statusLogs.map((log) => {
                                    const c = timelineColorMap[log.status] || timelineColorMap.OFFLINE;
                                    return (
                                        <div key={log.id} className="relative flex gap-4 pl-9">
                                            <div className={`absolute left-0 top-1 h-[30px] w-[30px] rounded-full ${c.dot} ring-4 ${c.ring} flex items-center justify-center`}>
                                                <div className="h-2 w-2 rounded-full bg-white" />
                                            </div>
                                            <div className="flex-1 bg-indigo-50/40 rounded-xl px-4 py-3 hover:shadow-sm transition-shadow">
                                                <div className="flex items-center justify-between">
                                                    <p className={`text-xs font-bold uppercase tracking-wider ${c.textColor}`}>{c.label}</p>
                                                    <span className="text-xs font-semibold text-[#18181B]">{formatTime(log.changedAt)}</span>
                                                </div>
                                                {log.note && <p className="text-xs text-[#71717A] mt-0.5">{log.note}</p>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Section 3: Recent Attendance table ──────────────────────── */}
            <div className="bg-white rounded-2xl border border-[#E4E4E7] overflow-hidden shadow-sm">
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#E4E4E7]">
                    <h3 className="font-semibold text-[#18181B]">Recent Attendance</h3>
                    <button className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition">
                        View All Logs <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-indigo-50/50 border-b border-[#E4E4E7]">
                                {["Date", "Check In", "Check Out", "Hours", "Location", "Status"].map(h => (
                                    <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-[#71717A] uppercase tracking-wider">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E4E4E7]">
                            {history.slice(0, 10).map((record) => {
                                const hours = record.checkIn && record.checkOut
                                    ? ((new Date(record.checkOut) - new Date(record.checkIn)) / 36e5).toFixed(1) : null;
                                return (
                                    <tr key={record.id} className="hover:bg-indigo-50/30 transition-colors">
                                        <td className="px-6 py-3.5 font-medium text-[#18181B] whitespace-nowrap">{formatDateShort(record.date)}</td>
                                        <td className="px-6 py-3.5 text-[#71717A]">{record.checkIn ? formatTime(record.checkIn) : "—"}</td>
                                        <td className="px-6 py-3.5 text-[#71717A]">{record.checkOut ? formatTime(record.checkOut) : "—"}</td>
                                        <td className="px-6 py-3.5 text-[#71717A]">{hours ? <span className="font-semibold text-[#18181B]">{hours} hrs</span> : "—"}</td>
                                        <td className="px-6 py-3.5">
                                            {record.location?.latitude ? (
                                                <a href={`https://www.google.com/maps?q=${record.location.latitude},${record.location.longitude}`}
                                                    target="_blank" rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 hover:underline text-xs font-medium">
                                                    <MapPin className="h-3 w-3" /> View
                                                </a>
                                            ) : <span className="text-gray-300">—</span>}
                                        </td>
                                        <td className="px-6 py-3.5"><StatusBadge status={record.status} /></td>
                                    </tr>
                                );
                            })}
                            {history.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-[#71717A]">No attendance records found</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// ─── Admin Employee Reports Panel ─────────────────────────────────────────────

const AdminReportsPanel = () => {
    const today = new Date();
    const [month, setMonth] = useState(today.getMonth() + 1);
    const [year, setYear] = useState(today.getFullYear());
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [showPicker, setShowPicker] = useState(false);
    const [search, setSearch] = useState("");
    const [teamFilter, setTeamFilter] = useState("ALL");

    const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); setSelectedEmployee(null); };
    const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); setSelectedEmployee(null); };
    const isNextDisabled = year > today.getFullYear() || (year === today.getFullYear() && month >= today.getMonth() + 1);

    const queryClient = useQueryClient();

    const updateStatusMutation = useMutation({
        mutationFn: (data) => api.post("/attendance/admin/update-status", data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-monthly-report"] });
            queryClient.invalidateQueries({ queryKey: ["employee-attendance"] });
        },
        onError: (err) => toast.error(err.response?.data?.message || "Failed to update status")
    });

    const StatusCell = ({ userId, date, status, isPast }) => {
        const [isEditing, setIsEditing] = useState(false);
        const displayStatus = status || (isPast ? "ABSENT" : null);
        if (!isEditing) return (
            <div onClick={() => setIsEditing(true)} className="cursor-pointer hover:bg-gray-100 p-1 rounded transition group flex items-center justify-center gap-1">
                {displayStatus ? <StatusBadge status={displayStatus} /> : <span className="text-gray-300 text-xs">—</span>}
                <span className="opacity-0 group-hover:opacity-100 text-[10px] text-gray-400">✎</span>
            </div>
        );
        return (
            <select autoFocus className="text-[10px] font-bold border rounded px-1 py-0.5 bg-white shadow-sm focus:ring-1 focus:ring-orange-400 outline-none"
                value={displayStatus || ""}
                onChange={(e) => { updateStatusMutation.mutate({ userId, date, status: e.target.value }); setIsEditing(false); }}
                onBlur={() => setIsEditing(false)}>
                <option value="" disabled>Status</option>
                {['PRESENT', 'ABSENT', 'HALF_DAY', 'WFH', 'LEAVE'].map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
            </select>
        );
    };

    const { data: reportData, isLoading: reportLoading } = useQuery({
        queryKey: ["admin-monthly-report", month, year],
        queryFn: async () => (await api.get(`/attendance/admin/monthly-report?month=${month}&year=${year}`)).data
    });

    // Department values are stored inconsistently (e.g. "FOREX" vs "Forex").
    // Normalize to one key so the same team isn't listed twice.
    const normTeam = (d) => (d || "").trim().toUpperCase().replace(/_/g, " ").replace(/\s+/g, " ");
    const prettyTeam = (key) => key.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

    // Distinct teams, deduped case-insensitively → [key, label].
    const teams = useMemo(() => {
        const map = new Map();
        (reportData?.report || []).forEach(r => {
            const key = normTeam(r.user?.department);
            if (key && !map.has(key)) map.set(key, prettyTeam(key));
        });
        return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
    }, [reportData]);

    // Apply team + name filters to the report rows.
    const filteredReport = useMemo(() => {
        const q = search.trim().toLowerCase();
        return (reportData?.report || []).filter(r =>
            (teamFilter === "ALL" || normTeam(r.user?.department) === teamFilter) &&
            (!q || r.user?.name?.toLowerCase().includes(q))
        );
    }, [reportData, search, teamFilter]);

    const { data: empDetail, isLoading: empLoading } = useQuery({
        queryKey: ["employee-attendance", selectedEmployee?.id, month, year],
        queryFn: async () => (await api.get(`/attendance/admin/employee/${selectedEmployee.id}?month=${month}&year=${year}`)).data,
        enabled: !!selectedEmployee
    });

    const formatDate = (dt) => new Date(dt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const formatTime = (dt) => new Date(dt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-[#18181B]">Employee Attendance</h1>
                    <p className="text-[#71717A] text-sm mt-0.5">Monthly attendance overview for all employees</p>
                </div>
                <div className="flex items-center gap-2 bg-white rounded-xl shadow-sm px-2 py-1.5 border border-[#E4E4E7]">
                    <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded-lg"><ChevronLeft className="h-4 w-4 text-gray-600" /></button>
                    <button onClick={() => setShowPicker(true)} className="font-semibold text-gray-900 min-w-[130px] text-center hover:bg-indigo-50 px-2 py-1 rounded-lg transition text-sm">{MONTHS[month - 1]} {year}</button>
                    <button onClick={nextMonth} disabled={isNextDisabled} className="p-1 hover:bg-gray-100 rounded-lg disabled:opacity-30"><ChevronRight className="h-4 w-4 text-gray-600" /></button>
                </div>
            </div>

            <MonthYearPicker isOpen={showPicker} onClose={() => setShowPicker(false)} currentMonth={month} currentYear={year}
                onSelect={(m, y) => { setMonth(m); setYear(y); setShowPicker(false); }} />

            {reportData?.meta && (
                <div className="grid grid-cols-3 gap-4">
                    {[
                        { label: "Working Days", value: reportData.meta.workingDays, color: "text-blue-600", border: "border-blue-300" },
                        { label: "Sundays (Holidays)", value: reportData.meta.sundayCount, color: "text-indigo-600", border: "border-indigo-300" },
                        { label: "Total Employees", value: reportData.report?.length || 0, color: "text-gray-700", border: "border-gray-300" },
                    ].map(c => (
                        <div key={c.label} className={`bg-white rounded-2xl border-l-4 ${c.border} border border-[#E4E4E7] p-4 text-center shadow-sm`}>
                            <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
                            <p className="text-xs text-[#71717A] mt-1">{c.label}</p>
                        </div>
                    ))}
                </div>
            )}

            <div className="bg-white rounded-2xl border border-[#E4E4E7] overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-[#E4E4E7] bg-indigo-50/50 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-indigo-600" />
                        <h2 className="font-semibold text-[#18181B]">Employee Monthly Summary</h2>
                        <span className="text-xs text-[#71717A] ml-1 hidden sm:inline">· click a row to view details</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Name search */}
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search by name…"
                                className="h-9 w-44 pl-8 pr-3 text-sm rounded-lg border border-gray-200 bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none placeholder:text-gray-400"
                            />
                        </div>
                        {/* Team filter */}
                        <div className="relative">
                            <select
                                value={teamFilter}
                                onChange={e => setTeamFilter(e.target.value)}
                                className={`h-9 pl-3 pr-8 text-sm font-semibold rounded-lg border bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none cursor-pointer appearance-none ${
                                    teamFilter === "ALL" ? "border-gray-200 text-gray-600" : "border-indigo-300 text-indigo-700"
                                }`}
                            >
                                <option value="ALL">All Teams</option>
                                {teams.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                            </select>
                            <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 rotate-90 pointer-events-none" />
                        </div>
                        {(search || teamFilter !== "ALL") && (
                            <button
                                onClick={() => { setSearch(""); setTeamFilter("ALL"); }}
                                className="text-xs font-semibold text-indigo-600 hover:underline"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </div>
                {reportLoading ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-indigo-600" /></div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-[#E4E4E7] bg-gray-50">
                                    {["Employee", "Present", "WFH", "Leave", "Half Day", "Absent", "Comp Off"].map(h => (
                                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#71717A] uppercase tracking-wider">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E4E4E7]">
                                {filteredReport.map((row) => (
                                    <tr key={row.user.id} onClick={() => setSelectedEmployee(row.user)}
                                        className={`cursor-pointer transition-colors hover:bg-indigo-50/30 ${selectedEmployee?.id === row.user.id ? "bg-indigo-50/40" : ""}`}>
                                        <td className="px-4 py-3">
                                            <p className="font-medium text-[#18181B]">{row.user.name}</p>
                                            <p className="text-xs text-[#71717A]">{row.user.department || row.user.email}</p>
                                        </td>
                                        <td className="px-4 py-3 text-center font-semibold text-green-600">{row.present}</td>
                                        <td className="px-4 py-3 text-center font-semibold text-purple-600">{row.wfh}</td>
                                        <td className="px-4 py-3 text-center font-semibold text-blue-600">{row.leave}</td>
                                        <td className="px-4 py-3 text-center font-semibold text-yellow-600">{row.halfDay}</td>
                                        <td className="px-4 py-3 text-center font-semibold text-red-500">{row.absent}</td>
                                        <td className="px-4 py-3 text-center font-bold text-indigo-600">{row.compOffBalance || 0}</td>
                                    </tr>
                                ))}
                                {filteredReport.length === 0 && (
                                    <tr><td colSpan="7" className="px-6 py-10 text-center text-[#71717A]">No employees found</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {selectedEmployee && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] backdrop-blur-sm p-4" onClick={() => setSelectedEmployee(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-[#E4E4E7] bg-indigo-50/50 flex items-center justify-between shrink-0">
                            <div>
                                <h2 className="font-semibold text-[#18181B] text-lg">{selectedEmployee.name}</h2>
                                <p className="text-sm text-[#71717A]">{MONTHS[month - 1]} {year} · Day-wise attendance</p>
                            </div>
                            <button onClick={() => setSelectedEmployee(null)} className="text-[#71717A] hover:text-gray-900 p-2 rounded-lg hover:bg-gray-100 transition">
                                <XCircle className="h-5 w-5" />
                            </button>
                        </div>
                        {empLoading ? (
                            <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-indigo-600" /></div>
                        ) : (
                            <div className="overflow-y-auto flex-1">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="sticky top-0 bg-white z-10">
                                            <tr className="border-b border-[#E4E4E7] bg-gray-50">
                                                {["Date", "Day", "Check In", "Check Out", "Hours", "Location", "Status"].map(h => (
                                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#71717A] uppercase tracking-wider">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#E4E4E7]">
                                            {generateMonthDays(year, month).map((day) => {
                                                const rec = empDetail?.attendance?.find(a => {
                                                    const d = new Date(a.date);
                                                    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}` === day.dateStr;
                                                });
                                                const hours = rec?.checkIn && rec?.checkOut
                                                    ? ((new Date(rec.checkOut) - new Date(rec.checkIn)) / 36e5).toFixed(1) : null;

                                                if (day.isSunday) return (
                                                    <tr key={day.d} className="bg-indigo-50/20">
                                                        <td className="px-4 py-2 text-indigo-700 font-medium">{String(day.d).padStart(2, "0")} {MONTHS[month - 1].slice(0, 3)}</td>
                                                        <td className="px-4 py-2 text-indigo-600 font-semibold">Sunday</td>
                                                        <td colSpan="4" className="px-4 py-2 text-indigo-400 text-xs">— Weekly Holiday —</td>
                                                        <td className="px-4 py-2"><span className="px-2 py-0.5 text-xs rounded-full bg-indigo-100 text-indigo-700">Holiday</span></td>
                                                    </tr>
                                                );

                                                return (
                                                    <tr key={day.d} className={`hover:bg-gray-50 ${day.isToday ? "bg-indigo-50/30" : ""}`}>
                                                        <td className="px-4 py-2 font-medium text-[#18181B]">{String(day.d).padStart(2, "0")} {MONTHS[month - 1].slice(0, 3)}</td>
                                                        <td className="px-4 py-2 text-[#71717A]">{day.dayName}</td>
                                                        <td className="px-4 py-2 text-[#71717A]">{rec?.checkIn ? formatTime(rec.checkIn) : "—"}</td>
                                                        <td className="px-4 py-2 text-[#71717A]">{rec?.checkOut ? formatTime(rec.checkOut) : "—"}</td>
                                                        <td className="px-4 py-2 text-[#71717A]">{hours ? `${hours} hrs` : "—"}</td>
                                                        <td className="px-4 py-2">
                                                            {rec?.location?.latitude ? (
                                                                <a href={`https://www.google.com/maps?q=${rec.location.latitude},${rec.location.longitude}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-indigo-600 hover:underline text-xs">
                                                                    <MapPin className="h-3 w-3" /> View
                                                                </a>
                                                            ) : "—"}
                                                        </td>
                                                        <td className="px-4 py-2 text-center">
                                                            <StatusCell userId={selectedEmployee.id} date={day.dateStr} status={rec?.status}
                                                                isPast={day.isPast && (!empDetail.employee?.createdAt || day.date >= new Date(new Date(empDetail.employee.createdAt).setHours(0,0,0,0)))} />
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {empDetail?.leaves?.length > 0 && (
                                    <div className="p-6 border-t border-[#E4E4E7]">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="font-semibold text-[#18181B]">Leave / WFH Applications this month</h3>
                                            <div className="text-sm bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full font-bold">
                                                Comp Off Balance: {empDetail?.compOffBalance || 0}
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            {empDetail.leaves.map(l => (
                                                <div key={l.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5 text-sm">
                                                    <span className="text-[#71717A]">{formatDate(l.fromDate)} → {formatDate(l.toDate)} ({l.totalDays} days)</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${l.leaveType === "WFH" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>{l.leaveType}</span>
                                                        <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${l.status === "APPROVED" ? "bg-green-100 text-green-700" : l.status === "REJECTED" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>{l.status}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Main Attendance Page ─────────────────────────────────────────────────────

const Attendance = () => {
    const { user } = useAuth();
    const isAdmin = user?.role === "SUPER_ADMIN";
    const [activeTab, setActiveTab] = useState("dashboard");

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[#18181B] tracking-tight">Attendance</h1>
                    <p className="text-sm text-[#71717A]">Track your attendance, check-ins, and logs</p>
                </div>
                <div className="flex items-center gap-1 bg-white rounded-xl shadow-sm p-1.5 border border-[#E4E4E7] w-fit">
                    {[
                        { id: "dashboard", icon: Clock,     label: "Dashboard"   },
                        { id: "logs",      icon: Calendar,  label: "My Logs"     },
                        ...(isAdmin ? [{ id: "reports", icon: Users, label: "Team Reports" }] : []),
                    ].map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${activeTab === tab.id ? "bg-indigo-600 text-white shadow-sm" : "text-[#71717A] hover:bg-indigo-50 hover:text-indigo-600"}`}>
                            <tab.icon className="h-4 w-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <div>
                {activeTab === "dashboard" && <CheckInPanel />}
                {activeTab === "logs"      && <MyLogsPanel />}
                {activeTab === "reports"   && isAdmin && <AdminReportsPanel />}
            </div>
        </div>
    );
};

export default Attendance;
