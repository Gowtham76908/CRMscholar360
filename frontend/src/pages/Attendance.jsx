import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { Clock, CheckCircle, XCircle, Calendar, MapPin, Loader2, ChevronLeft, ChevronRight, Users, Briefcase } from "lucide-react";

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
        PRESENT: { bg: "bg-green-100 text-green-700", label: "Present" },
        ABSENT: { bg: "bg-red-100 text-red-700", label: "Absent" },
        LEAVE: { bg: "bg-blue-100 text-blue-700", label: "Leave" },
        WFH: { bg: "bg-purple-100 text-purple-700", label: "WFH" },
        HALF_DAY: { bg: "bg-yellow-100 text-yellow-700", label: "Half Day" }
    };
    const s = map[status] || { bg: "bg-gray-100 text-gray-500", label: status };
    return (
        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${s.bg}`}>{s.label}</span>
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
                    <h3 className="text-lg font-bold text-gray-900 text-center flex-1">Select Month & Year</h3>
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
                            className={`px-4 py-2 text-sm font-bold rounded-xl transition ${currentYear === y ? "bg-purple-600 text-white shadow" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
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
    const { user } = useAuth();
    const today = new Date();
    const [month, setMonth] = useState(today.getMonth() + 1);
    const [year, setYear] = useState(today.getFullYear());

    const [showPicker, setShowPicker] = useState(false);

    const { data: records = [], isLoading } = useQuery({
        queryKey: ["my-attendance-history", month, year],
        queryFn: async () => {
            const res = await api.get(`/attendance/my?month=${month}&year=${year}`);
            return res.data;
        }
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

    const prevMonth = () => {
        if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">My Log</h2>
                    <p className="text-gray-500 text-sm">Monthly attendance summary</p>
                </div>
                <div className="flex items-center gap-3 bg-white rounded-xl shadow px-2 py-1.5 border border-gray-100 select-none">
                    <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded-lg">
                        <ChevronLeft className="h-5 w-5 text-gray-600" />
                    </button>
                    <button 
                        onClick={() => setShowPicker(true)}
                        className="font-bold text-gray-900 min-w-[130px] text-center hover:bg-indigo-50 px-2 py-1 rounded-lg transition"
                    >
                        {MONTHS[month - 1]} {year}
                    </button>
                    <button onClick={nextMonth} disabled={isNextDisabled} className="p-1 hover:bg-gray-100 rounded-lg disabled:opacity-30">
                        <ChevronRight className="h-5 w-5 text-gray-600" />
                    </button>
                </div>
            </div>

            <MonthYearPicker
                isOpen={showPicker}
                onClose={() => setShowPicker(false)}
                currentMonth={month}
                currentYear={year}
                onSelect={(m, y) => {
                    setMonth(m);
                    setYear(y);
                    setShowPicker(false);
                }}
            />

            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                {isLoading ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider font-bold">
                                <tr>
                                    <th className="px-6 py-4 text-left">Date</th>
                                    <th className="px-6 py-4 text-left">Day</th>
                                    <th className="px-6 py-4 text-left">Check In</th>
                                    <th className="px-6 py-4 text-left">Check Out</th>
                                    <th className="px-6 py-4 text-left">Hours</th>
                                    <th className="px-6 py-4 text-left">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {days.map((day) => {
                                    const rec = recordMap[day.dateStr];
                                    const hours = rec?.checkIn && rec?.checkOut
                                        ? ((new Date(rec.checkOut) - new Date(rec.checkIn)) / 36e5).toFixed(1)
                                        : null;

                                    if (day.isSunday) return (
                                        <tr key={day.d} className="bg-orange-50/50">
                                            <td className="px-6 py-3 font-medium text-orange-700">{String(day.d).padStart(2, "0")} {MONTHS[month - 1].slice(0, 3)}</td>
                                            <td className="px-6 py-3 text-orange-600">{day.dayName}</td>
                                            <td colSpan="3" className="px-6 py-3 text-orange-400 text-xs italic">— Weekly Holiday —</td>
                                            <td className="px-6 py-3"><span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-orange-100 text-orange-700">Holiday</span></td>
                                        </tr>
                                    );

                                    return (
                                        <tr key={day.d} className={`hover:bg-gray-50 transition-colors ${day.isToday ? "bg-indigo-50/50" : ""}`}>
                                            <td className="px-6 py-3 font-medium text-gray-900">{String(day.d).padStart(2, "0")} {MONTHS[month - 1].slice(0, 3)}</td>
                                            <td className="px-6 py-3 text-gray-500 font-medium">{day.dayName}</td>
                                            <td className="px-6 py-3 text-gray-700">{rec?.checkIn ? formatTime(rec.checkIn) : <span className="text-gray-300">—</span>}</td>
                                            <td className="px-6 py-3 text-gray-700">{rec?.checkOut ? formatTime(rec.checkOut) : <span className="text-gray-300">—</span>}</td>
                                            <td className="px-6 py-3 text-gray-700">{hours ? <span className="font-semibold">{hours} hrs</span> : <span className="text-gray-300">—</span>}</td>
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

const CheckInPanel = () => {
    const queryClient = useQueryClient();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [isGettingLocation, setIsGettingLocation] = useState(false);

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
                toast.error(`Late check-in: ${d.message}. Deadline was ${d.deadline}. Contact HR for assistance.`);
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
        onError: (error) => {
            toast.error(error.response?.data?.message || "Failed to check out");
        }
    });

    const handleCheckIn = () => {
        setIsGettingLocation(true);
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setIsGettingLocation(false);
                    checkInMutation.mutate({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    });
                },
                () => {
                    setIsGettingLocation(false);
                    checkInMutation.mutate({});
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        } else {
            setIsGettingLocation(false);
            checkInMutation.mutate({});
        }
    };

    const formatTime = (dt) => new Date(dt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const formatDate = (dt) => new Date(dt).toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" });

    const getStatusBadge = (status) => {
        const styles = {
            PRESENT: "bg-green-100 text-green-700",
            ABSENT: "bg-red-100 text-red-700",
            LEAVE: "bg-blue-100 text-blue-700",
            WFH: "bg-purple-100 text-purple-700",
            HALF_DAY: "bg-yellow-100 text-yellow-700"
        };
        return (
            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${styles[status] || "bg-gray-100 text-gray-600"}`}>
                {status.replace("_", " ")}
            </span>
        );
    };

    const isPending = isGettingLocation || checkInMutation.isPending;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Attendance</h1>
                        <p className="text-gray-500 mt-1">{formatDate(currentTime)}</p>
                    </div>
                    <div className="text-right">
                        <div className="text-4xl font-bold text-gray-900">
                            {currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </div>
                        <div className="text-sm text-gray-500 mt-1">Current Time</div>
                    </div>
                </div>
            </div>

            {/* Check-in/out Card */}
            <div className="bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl shadow-lg p-8 text-white">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Clock className="h-12 w-12 shrink-0" />
                        <div>
                            <h2 className="text-2xl font-bold">
                                {attendanceToday?.checkIn && !attendanceToday?.checkOut ? "Ready to Check Out?" : "Mark Your Attendance"}
                            </h2>
                            <p className="text-blue-100 mt-1">
                                {attendanceToday?.checkIn
                                    ? `Checked in at ${formatTime(attendanceToday.checkIn)}`
                                    : "Start your day by checking in"}
                            </p>
                            {attendanceToday?.checkOut && (
                                <p className="text-blue-100">Checked out at {formatTime(attendanceToday.checkOut)}</p>
                            )}
                            {attendanceToday?.location?.latitude && (
                                <a
                                    href={`https://www.google.com/maps?q=${attendanceToday.location.latitude},${attendanceToday.location.longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-blue-200 hover:text-white text-sm mt-1 transition"
                                >
                                    <MapPin className="h-3 w-3" />
                                    Location recorded — View on map
                                </a>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-3 shrink-0">
                        <button
                            onClick={handleCheckIn}
                            disabled={isPending || !!attendanceToday?.checkIn || !isCheckInAllowed()}
                            className="px-8 py-4 bg-white text-blue-600 rounded-xl font-semibold hover:bg-blue-50 transition shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            title={!isCheckInAllowed() && !attendanceToday?.checkIn ? `Check-in deadline (${new Date().getDay() === 0 ? '12:30 PM' : '11:50 AM'}) has passed` : ""}
                        >
                            {isPending && !attendanceToday?.checkIn ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            {isGettingLocation ? "Getting Location..." :
                                checkInMutation.isPending ? "Checking In..." :
                                    attendanceToday?.checkIn ? "Checked In ✓" :
                                        !isCheckInAllowed() ? "Check-in Closed" : "Check In"}
                        </button>
                        <button
                            onClick={() => checkOutMutation.mutate()}
                            disabled={checkOutMutation.isPending || !attendanceToday?.checkIn || !!attendanceToday?.checkOut}
                            className="px-8 py-4 bg-white text-purple-600 rounded-xl font-semibold hover:bg-purple-50 transition shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {checkOutMutation.isPending ? "Checking Out..." : attendanceToday?.checkOut ? "Checked Out ✓" : "Check Out"}
                        </button>
                    </div>
                </div>
                {!isCheckInAllowed() && !attendanceToday?.checkIn && (
                    <p className="text-yellow-300 text-sm mt-3">⚠️ Check-in deadline ({new Date().getDay() === 0 ? '12:30 PM' : '11:50 AM'}) has passed. Please contact HR.</p>
                )}
                {!attendanceToday?.checkIn && isCheckInAllowed() && (
                    <p className="text-blue-200 text-xs mt-2 flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> Your location will be captured on check-in (browser permission required)
                    </p>
                )}
            </div>

            {/* Today's Status Activity Log */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-xl">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <Clock className="h-5 w-5 text-indigo-500" />
                        Today's Status Activity
                    </h2>
                </div>
                <div className="p-6">
                    {statusLogs.length === 0 ? (
                        <p className="text-center text-gray-500 py-4">No status updates today</p>
                    ) : (
                        <div className="relative border-l-2 border-indigo-100 ml-4 space-y-6 pb-2">
                            {statusLogs.map((log) => {
                                const map = {
                                    ONLINE: { bg: "bg-green-100 border-green-400", color: "text-green-600" },
                                    BREAK: { bg: "bg-yellow-100 border-yellow-400", color: "text-yellow-600" },
                                    OFFLINE: { bg: "bg-red-100 border-red-400", color: "text-red-600" }
                                };
                                const s = map[log.status] || map.OFFLINE;
                                return (
                                    <div key={log.id} className="relative pl-6">
                                        <div className={`absolute -left-[11px] top-1 w-5 h-5 rounded-full border-2 bg-white flex items-center justify-center ${s.bg}`}>
                                            <div className={`w-2 h-2 rounded-full ${s.bg.replace('border-', 'bg-').split(' ')[1]}`}></div>
                                        </div>
                                        <div className="bg-gray-50 border text-sm border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition flex justify-between items-center">
                                            <div>
                                                <p className={`font-bold uppercase tracking-wider text-xs ${s.color}`}>
                                                    {log.status === 'BREAK' ? 'On Break' : log.status}
                                                </p>
                                                <p className="text-gray-500 mt-1 text-xs">{log.note || 'Status updated manually'}</p>
                                            </div>
                                            <div className="text-right">
                                                <span className="font-semibold text-gray-900">{formatTime(log.changedAt)}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-blue-500">
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Total Days</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{stats?.total || 0}</p>
                </div>
                <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-green-500">
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Present</p>
                    <p className="text-2xl font-bold text-green-600 mt-1">{stats?.present || 0}</p>
                </div>
                <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-purple-500">
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">WFH</p>
                    <p className="text-2xl font-bold text-purple-600 mt-1">{stats?.wfh || 0}</p>
                </div>
                <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-red-500">
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Absent</p>
                    <p className="text-2xl font-bold text-red-600 mt-1">{stats?.absent || 0}</p>
                </div>
                <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl shadow-md p-5 border-l-4 border-indigo-500">
                    <p className="text-indigo-600 text-xs font-bold uppercase tracking-wider">Comp Off Balance</p>
                    <p className="text-2xl font-bold text-indigo-700 mt-1">{stats?.compOffBalance || 0}</p>
                    <p className="text-[10px] text-indigo-400 mt-1">Sundays worked credits</p>
                </div>
            </div>

            {/* History */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                    <h2 className="text-xl font-bold text-gray-900">Recent Attendance</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check In</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check Out</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {history.slice(0, 30).map((record) => {
                                const hours = record.checkIn && record.checkOut
                                    ? ((new Date(record.checkOut) - new Date(record.checkIn)) / 36e5).toFixed(2)
                                    : null;
                                return (
                                    <tr key={record.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{formatDate(record.date)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{record.checkIn ? formatTime(record.checkIn) : "—"}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{record.checkOut ? formatTime(record.checkOut) : "—"}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{hours ? `${hours} hrs` : "—"}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            {record.location?.latitude ? (
                                                <a
                                                    href={`https://www.google.com/maps?q=${record.location.latitude},${record.location.longitude}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-1 text-indigo-600 hover:underline"
                                                >
                                                    <MapPin className="h-3 w-3" /> View
                                                </a>
                                            ) : "—"}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(record.status)}</td>
                                    </tr>
                                );
                            })}
                            {history.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-gray-500">No attendance records found</td>
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

    const prevMonth = () => {
        if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1);
        setSelectedEmployee(null);
    };
    const nextMonth = () => {
        if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1);
        setSelectedEmployee(null);
    };
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

    const handleUpdateStatus = (userId, date, status) => {
        updateStatusMutation.mutate({ userId, date, status });
    };

    const StatusCell = ({ userId, date, status, isPast }) => {
        const [isEditing, setIsEditing] = useState(false);

        const displayStatus = status || (isPast ? "ABSENT" : null);

        if (!isEditing) {
            return (
                <div
                    onClick={() => setIsEditing(true)}
                    className="cursor-pointer hover:bg-gray-100 p-1 rounded transition-all group flex items-center justify-center gap-1"
                >
                    {displayStatus ? <StatusBadge status={displayStatus} /> : <span className="text-gray-300 text-xs">—</span>}
                    <span className="opacity-0 group-hover:opacity-100 text-[10px] text-gray-400">✎</span>
                </div>
            );
        }

        return (
            <select
                autoFocus
                className="text-[10px] font-bold border rounded px-1 py-0.5 bg-white shadow-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                value={displayStatus || ""}
                onChange={(e) => {
                    handleUpdateStatus(userId, date, e.target.value);
                    setIsEditing(false);
                }}
                onBlur={() => setIsEditing(false)}
            >
                <option value="" disabled>Status</option>
                {['PRESENT', 'ABSENT', 'HALF_DAY', 'WFH', 'LEAVE'].map(s => (
                    <option key={s} value={s}>{s.replace("_", " ")}</option>
                ))}
            </select>
        );
    };

    const { data: reportData, isLoading: reportLoading } = useQuery({
        queryKey: ["admin-monthly-report", month, year],
        queryFn: async () => (await api.get(`/attendance/admin/monthly-report?month=${month}&year=${year}`)).data
    });

    const { data: empDetail, isLoading: empLoading } = useQuery({
        queryKey: ["employee-attendance", selectedEmployee?.id, month, year],
        queryFn: async () => (await api.get(`/attendance/admin/employee/${selectedEmployee.id}?month=${month}&year=${year}`)).data,
        enabled: !!selectedEmployee
    });

    const formatDate = (dt) => new Date(dt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const formatTime = (dt) => new Date(dt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

    const statusBadge = (status) => <StatusBadge status={status} />;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Employee Attendance</h1>
                    <p className="text-gray-500 mt-1">Monthly attendance overview for all employees</p>
                </div>
                <div className="flex items-center gap-3 bg-white rounded-xl shadow px-2 py-1.5 border border-gray-100 select-none">
                    <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded-lg">
                        <ChevronLeft className="h-5 w-5 text-gray-600" />
                    </button>
                    <button 
                        onClick={() => setShowPicker(true)}
                        className="font-bold text-gray-900 min-w-[130px] text-center hover:bg-indigo-50 px-2 py-1 rounded-lg transition"
                    >
                        {MONTHS[month - 1]} {year}
                    </button>
                    <button onClick={nextMonth} disabled={isNextDisabled} className="p-1 hover:bg-gray-100 rounded-lg disabled:opacity-30">
                        <ChevronRight className="h-5 w-5 text-gray-600" />
                    </button>
                </div>
            </div>

            <MonthYearPicker
                isOpen={showPicker}
                onClose={() => setShowPicker(false)}
                currentMonth={month}
                currentYear={year}
                onSelect={(m, y) => {
                    setMonth(m);
                    setYear(y);
                    setShowPicker(false);
                }}
            />

            {/* Summary meta */}
            {reportData?.meta && (
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-blue-400 text-center">
                        <p className="text-2xl font-bold text-blue-600">{reportData.meta.workingDays}</p>
                        <p className="text-xs text-gray-500 mt-1">Working Days</p>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-orange-400 text-center">
                        <p className="text-2xl font-bold text-orange-600">{reportData.meta.sundayCount}</p>
                        <p className="text-xs text-gray-500 mt-1">Sundays (Holidays)</p>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-gray-400 text-center">
                        <p className="text-2xl font-bold text-gray-700">{reportData.report?.length || 0}</p>
                        <p className="text-xs text-gray-500 mt-1">Total Employees</p>
                    </div>
                </div>
            )}

            {/* Employee Summary Table */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50 flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-600" />
                    <h2 className="font-bold text-gray-900">Employee Monthly Summary</h2>
                    <span className="text-sm text-gray-500 ml-1">— click a row to view details</span>
                </div>
                {reportLoading ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                                <tr>
                                    <th className="px-4 py-3 text-left">Employee</th>
                                    <th className="px-4 py-3 text-center">Present</th>
                                    <th className="px-4 py-3 text-center">WFH</th>
                                    <th className="px-4 py-3 text-center">Leave</th>
                                    <th className="px-4 py-3 text-center">Half Day</th>
                                    <th className="px-4 py-3 text-center">Absent</th>
                                <th className="px-4 py-3 text-center">Comp Off Balance</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {reportData?.report?.map((row) => (
                                <tr
                                    key={row.user.id}
                                    onClick={() => setSelectedEmployee(row.user)}
                                    className={`hover:bg-indigo-50 cursor-pointer transition ${selectedEmployee?.id === row.user.id ? "bg-indigo-50" : ""}`}
                                >
                                    <td className="px-4 py-3">
                                        <p className="font-medium text-gray-900">{row.user.name}</p>
                                        <p className="text-xs text-gray-500">{row.user.department || row.user.email}</p>
                                    </td>
                                    <td className="px-4 py-3 text-center"><span className="font-semibold text-green-600">{row.present}</span></td>
                                    <td className="px-4 py-3 text-center"><span className="font-semibold text-purple-600">{row.wfh}</span></td>
                                    <td className="px-4 py-3 text-center"><span className="font-semibold text-blue-600">{row.leave}</span></td>
                                    <td className="px-4 py-3 text-center"><span className="font-semibold text-yellow-600">{row.halfDay}</span></td>
                                    <td className="px-4 py-3 text-center"><span className="font-semibold text-red-600">{row.absent}</span></td>
                                    <td className="px-4 py-3 text-center"><span className="font-bold text-indigo-600">{row.compOffBalance || 0}</span></td>
                                </tr>
                            ))}
                                {(!reportData?.report || reportData.report.length === 0) && (
                                    <tr><td colSpan="6" className="px-6 py-10 text-center text-gray-500">No employees found</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Employee Detail Drill-Down */}
            {selectedEmployee && (
                <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50 flex items-center justify-between">
                        <div>
                            <h2 className="font-bold text-gray-900 text-lg">{selectedEmployee.name}</h2>
                            <p className="text-sm text-gray-500">{MONTHS[month - 1]} {year} — Day-wise attendance</p>
                        </div>
                        <button onClick={() => setSelectedEmployee(null)} className="text-gray-400 hover:text-gray-600 text-sm px-3 py-1 rounded-lg hover:bg-gray-100">
                            Close ✕
                        </button>
                    </div>
                    {empLoading ? (
                        <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-indigo-500" /></div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Date</th>
                                        <th className="px-4 py-3 text-left">Day</th>
                                        <th className="px-4 py-3 text-left">Check In</th>
                                        <th className="px-4 py-3 text-left">Check Out</th>
                                        <th className="px-4 py-3 text-left">Hours</th>
                                        <th className="px-4 py-3 text-left">Location</th>
                                        <th className="px-4 py-3 text-left">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {generateMonthDays(year, month).map((day) => {
                                        const rec = empDetail?.attendance?.find(a => {
                                            const d = new Date(a.date);
                                            return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}` === day.dateStr;
                                        });
                                        const hours = rec?.checkIn && rec?.checkOut
                                            ? ((new Date(rec.checkOut) - new Date(rec.checkIn)) / 36e5).toFixed(1)
                                            : null;

                                        if (day.isSunday) return (
                                            <tr key={day.d} className="bg-orange-50">
                                                <td className="px-4 py-2 text-orange-700 font-medium">{String(day.d).padStart(2, "0")} {MONTHS[month - 1].slice(0, 3)}</td>
                                                <td className="px-4 py-2 text-orange-600 font-semibold">Sunday</td>
                                                <td colSpan="4" className="px-4 py-2 text-orange-400 text-xs">— Weekly Holiday —</td>
                                                <td className="px-4 py-2"><span className="px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-700">Holiday</span></td>
                                            </tr>
                                        );

                                        return (
                                            <tr key={day.d} className={`hover:bg-gray-50 ${day.isToday ? "bg-indigo-50" : ""}`}>
                                                <td className="px-4 py-2 font-medium text-gray-900">
                                                    {String(day.d).padStart(2, "0")} {MONTHS[month - 1].slice(0, 3)}
                                                </td>
                                                <td className="px-4 py-2 text-gray-500">{day.dayName}</td>
                                                <td className="px-4 py-2 text-gray-700">{rec?.checkIn ? formatTime(rec.checkIn) : "—"}</td>
                                                <td className="px-4 py-2 text-gray-700">{rec?.checkOut ? formatTime(rec.checkOut) : "—"}</td>
                                                <td className="px-4 py-2 text-gray-700">{hours ? `${hours} hrs` : "—"}</td>
                                                <td className="px-4 py-2">
                                                    {rec?.location?.latitude ? (
                                                        <a href={`https://www.google.com/maps?q=${rec.location.latitude},${rec.location.longitude}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-indigo-600 hover:underline text-xs">
                                                            <MapPin className="h-3 w-3" /> View
                                                        </a>
                                                    ) : "—"}
                                                </td>
                                                <td className="px-4 py-2 text-center">
                                                    <StatusCell 
                                                        userId={selectedEmployee.id}
                                                        date={day.dateStr}
                                                        status={rec?.status}
                                                        isPast={day.isPast && (!empDetail.employee?.createdAt || day.date >= new Date(new Date(empDetail.employee.createdAt).setHours(0,0,0,0)))}
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Leaves in this month */}
                    {empDetail?.leaves?.length > 0 && (
                        <div className="p-6 border-t border-gray-200">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-semibold text-gray-900">Leave / WFH Applications this month</h3>
                                <div className="text-sm bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full font-bold">
                                    Comp Off Balance: {empDetail?.compOffBalance || 0}
                                </div>
                            </div>
                            <div className="space-y-2">
                                {empDetail.leaves.map(l => (
                                    <div key={l.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2 text-sm">
                                        <span className="text-gray-700">{formatDate(l.fromDate)} → {formatDate(l.toDate)} ({l.totalDays} days)</span>
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
    );
};

// ─── Main Attendance Page ─────────────────────────────────────────────────────

const Attendance = () => {
    const { user } = useAuth();
    const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(user?.role);
    const [activeTab, setActiveTab] = useState("dashboard"); // dashboard, logs, reports

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Attendance</h1>
                    <p className="text-sm text-gray-500">Track check-ins, logs, and team reports</p>
                </div>
                {/* Tab Switcher */}
                <div className="flex flex-wrap gap-2 bg-white rounded-xl shadow-sm p-1.5 border border-gray-100 w-fit">
                    <button
                        onClick={() => setActiveTab("dashboard")}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition ${activeTab === "dashboard" ? "bg-indigo-600 text-white shadow-lg" : "text-gray-600 hover:bg-gray-100"}`}
                    >
                        <Clock className="h-4 w-4" />
                        Dashboard
                    </button>
                    <button
                        onClick={() => setActiveTab("logs")}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition ${activeTab === "logs" ? "bg-indigo-600 text-white shadow-lg" : "text-gray-600 hover:bg-gray-100"}`}
                    >
                        <Calendar className="h-4 w-4" />
                        My Logs
                    </button>
                    {isAdmin && (
                        <button
                            onClick={() => setActiveTab("reports")}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition ${activeTab === "reports" ? "bg-indigo-600 text-white shadow-lg" : "text-gray-600 hover:bg-gray-100"}`}
                        >
                            <Users className="h-4 w-4" />
                            Team Reports
                        </button>
                    )}
                </div>
            </div>

            <div className="transition-all duration-300">
                {activeTab === "dashboard" && <CheckInPanel />}
                {activeTab === "logs" && <MyLogsPanel />}
                {activeTab === "reports" && isAdmin && <AdminReportsPanel />}
            </div>
        </div>
    );
};

export default Attendance;
