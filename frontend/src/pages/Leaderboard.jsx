import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../api/axios";
import { Trophy, Medal, Target, Clock, ChevronLeft, ChevronRight, Loader2, User, Award, Star } from "lucide-react";

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const Leaderboard = () => {
    const today = new Date();
    const [month, setMonth] = useState(today.getMonth() + 1);
    const [year, setYear] = useState(today.getFullYear());

    const { data: leaderboard = [], isLoading } = useQuery({
        queryKey: ["leaderboard", month, year],
        queryFn: async () => {
            const res = await api.get(`/analytics/leaderboard?month=${month}&year=${year}`);
            return res.data;
        }
    });

    const prevMonth = () => {
        if (month === 1) { setMonth(12); setYear(y => y - 1); }
        else setMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (month === 12) { setMonth(1); setYear(y => y + 1); }
        else setMonth(m => m + 1);
    };
    const isNextDisabled = year > today.getFullYear() || (year === today.getFullYear() && month >= today.getMonth() + 1);

    const top3 = leaderboard.slice(0, 3);
    const others = leaderboard.slice(3);

    return (
        <div className="space-y-6">
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                            <Trophy className="h-6 w-6 text-yellow-500" />
                            Leaderboard
                        </h1>
                        <p className="text-sm text-gray-500">Recognizing excellence in attendance and task performance</p>
                    </div>

                    {/* Month Navigator */}
                    <div className="flex items-center gap-3 bg-white/80 backdrop-blur-md rounded-2xl shadow-xl px-6 py-3 border border-indigo-100 italic">
                        <button onClick={prevMonth} className="p-2 hover:bg-indigo-50 rounded-xl transition-all active:scale-90">
                            <ChevronLeft className="h-6 w-6 text-indigo-600" />
                        </button>
                        <div className="text-center min-w-[160px]">
                            <p className="font-bold text-gray-900 text-xl">{MONTHS[month - 1]} {year}</p>
                        </div>
                        <button onClick={nextMonth} disabled={isNextDisabled} className="p-2 hover:bg-indigo-50 rounded-xl transition-all active:scale-90 disabled:opacity-30">
                            <ChevronRight className="h-6 w-6 text-indigo-600" />
                        </button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-32 space-y-4">
                        <Loader2 className="h-12 w-12 animate-spin text-indigo-500" />
                        <p className="text-indigo-600 font-medium animate-pulse">Calculating rankings...</p>
                    </div>
                ) : leaderboard.length === 0 ? (
                    <div className="bg-white rounded-3xl shadow-xl p-16 text-center border border-dashed border-indigo-200">
                        <Trophy className="h-20 w-20 text-gray-300 mx-auto mb-6" />
                        <h3 className="text-2xl font-bold text-gray-800">No data for this period</h3>
                        <p className="text-gray-500 mt-2">Points will appear once attendance and tasks are recorded.</p>
                    </div>
                ) : (
                    <>
                        {/* Podium - Top 3 */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-end pt-12">
                            {/* 2nd Place */}
                            {top3[1] && (
                                <div className="order-2 md:order-1 flex flex-col items-center group">
                                    <div className="relative mb-4">
                                        <div className="h-24 w-24 rounded-full border-4 border-slate-300 overflow-hidden shadow-2xl group-hover:scale-110 transition-transform duration-500 p-1 bg-white">
                                            {top3[1].user.profilePhoto ? (
                                                <img src={top3[1].user.profilePhoto} alt={top3[1].user.name} className="h-full w-full object-cover rounded-full" />
                                            ) : (
                                                <div className="h-full w-full bg-slate-100 flex items-center justify-center"><User className="h-10 w-10 text-slate-400" /></div>
                                            )}
                                        </div>
                                        <div className="absolute -bottom-2 -right-2 bg-slate-400 text-white h-10 w-10 rounded-full flex items-center justify-center font-bold text-xl border-4 border-white shadow-lg">2</div>
                                    </div>
                                    <div className="bg-white/90 backdrop-blur-md rounded-3xl p-6 shadow-xl border border-slate-200 w-full text-center hover:shadow-2xl transition-shadow border-b-8 border-b-slate-300">
                                        <h3 className="text-xl font-bold text-gray-900 truncate">{top3[1].user.name}</h3>
                                        <p className="text-sm text-gray-500 mb-4">{top3[1].user.jobTitle || 'Team Member'}</p>
                                        <div className="text-3xl font-black text-slate-600">{top3[1].totalScore} <span className="text-xs font-normal uppercase">pts</span></div>
                                    </div>
                                </div>
                            )}

                            {/* 1st Place */}
                            {top3[0] && (
                                <div className="order-1 md:order-2 flex flex-col items-center group scale-110 z-10">
                                    <div className="relative mb-6">
                                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 animate-bounce">
                                            <Star className="h-10 w-10 text-yellow-500 fill-yellow-500" />
                                        </div>
                                        <div className="h-32 w-32 rounded-full border-4 border-yellow-400 overflow-hidden shadow-[0_0_50px_rgba(234,179,8,0.3)] group-hover:scale-110 transition-transform duration-500 p-1 bg-white">
                                            {top3[0].user.profilePhoto ? (
                                                <img src={top3[0].user.profilePhoto} alt={top3[0].user.name} className="h-full w-full object-cover rounded-full" />
                                            ) : (
                                                <div className="h-full w-full bg-yellow-50 flex items-center justify-center"><User className="h-12 w-12 text-yellow-600" /></div>
                                            )}
                                        </div>
                                        <div className="absolute -bottom-2 -right-2 bg-yellow-500 text-white h-12 w-12 rounded-full flex items-center justify-center font-black text-2xl border-4 border-white shadow-lg">1</div>
                                    </div>
                                    <div className="bg-white rounded-3xl p-8 shadow-2xl border border-yellow-100 w-full text-center hover:shadow-[0_20px_60px_-15px_rgba(234,179,8,0.2)] transition-all border-b-8 border-b-yellow-500">
                                        <h3 className="text-2xl font-black text-gray-900 truncate">{top3[0].user.name}</h3>
                                        <p className="text-sm text-yellow-600 font-bold mb-4 uppercase tracking-wider">{top3[0].user.jobTitle || 'Champion'}</p>
                                        <div className="text-5xl font-black text-yellow-600">{top3[0].totalScore} <span className="text-sm font-normal text-gray-400 uppercase">pts</span></div>
                                        <div className="mt-4 flex justify-center gap-2">
                                            <span className="bg-yellow-100 text-yellow-700 text-[10px] font-bold px-2 py-1 rounded-full border border-yellow-200 uppercase tracking-tighter">Gold Performer</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 3rd Place */}
                            {top3[2] && (
                                <div className="order-3 flex flex-col items-center group">
                                    <div className="relative mb-4">
                                        <div className="h-24 w-24 rounded-full border-4 border-amber-600 overflow-hidden shadow-2xl group-hover:scale-110 transition-transform duration-500 p-1 bg-white">
                                            {top3[2].user.profilePhoto ? (
                                                <img src={top3[2].user.profilePhoto} alt={top3[2].user.name} className="h-full w-full object-cover rounded-full" />
                                            ) : (
                                                <div className="h-full w-full bg-amber-50 flex items-center justify-center"><User className="h-10 w-10 text-amber-600" /></div>
                                            )}
                                        </div>
                                        <div className="absolute -bottom-2 -right-2 bg-amber-700 text-white h-10 w-10 rounded-full flex items-center justify-center font-bold text-xl border-4 border-white shadow-lg">3</div>
                                    </div>
                                    <div className="bg-white/90 backdrop-blur-md rounded-3xl p-6 shadow-xl border border-amber-100 w-full text-center hover:shadow-2xl transition-shadow border-b-8 border-b-amber-700">
                                        <h3 className="text-xl font-bold text-gray-900 truncate">{top3[2].user.name}</h3>
                                        <p className="text-sm text-gray-500 mb-4">{top3[2].user.jobTitle || 'Star Player'}</p>
                                        <div className="text-3xl font-black text-amber-700">{top3[2].totalScore} <span className="text-xs font-normal uppercase">pts</span></div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Complete Rankings Table */}
                        <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-indigo-50 border-t-8 border-t-indigo-600">
                            <div className="p-8 border-b border-gray-100 flex items-center justify-between">
                                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                    <Award className="h-7 w-7 text-indigo-600" />
                                    Employee Rankings
                                </h2>
                                <div className="flex gap-4">
                                    <div className="flex items-center gap-1 text-xs font-semibold px-3 py-1 bg-green-50 text-green-700 rounded-full border border-green-100">
                                        <Clock className="h-3 w-3" /> Punctuality Bonus Incl.
                                    </div>
                                    <div className="flex items-center gap-1 text-xs font-semibold px-3 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-100">
                                        <Target className="h-3 w-3" /> Task Bonus Incl.
                                    </div>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-indigo-50/30 text-indigo-900/50 uppercase text-[10px] tracking-widest font-black">
                                            <th className="px-8 py-5 text-left">Rank</th>
                                            <th className="px-8 py-5 text-left">Member</th>
                                            <th className="px-8 py-5 text-center">Stats</th>
                                            <th className="px-8 py-5 text-center">Score Breakdown</th>
                                            <th className="px-8 py-5 text-right">Total Pts</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {leaderboard.map((row, index) => (
                                            <tr key={row.user.id} className="hover:bg-indigo-50/40 transition-colors group">
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gray-50 font-black text-gray-400 group-hover:bg-white transition-colors border border-gray-100 group-hover:text-indigo-600">
                                                        #{index + 1}
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-12 w-12 rounded-2xl overflow-hidden bg-gray-100 border-2 border-white shadow-md flex-shrink-0">
                                                            {row.user.profilePhoto ? (
                                                                <img src={row.user.profilePhoto} alt={row.user.name} className="h-full w-full object-cover" />
                                                            ) : (
                                                                <div className="h-full w-full flex items-center justify-center text-gray-400 bg-gray-50"><User className="h-6 w-6" /></div>
                                                            )}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="font-bold text-gray-900 truncate">{row.user.name}</p>
                                                            <p className="text-xs text-gray-400 truncate">{row.user.jobTitle || 'Consultant'}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <div className="flex justify-center items-center gap-4">
                                                        <div className="text-center" title="Days Present">
                                                            <p className="text-xs font-black text-gray-900">{row.stats.presentDays}</p>
                                                            <p className="text-[10px] text-gray-400 uppercase font-medium">Days</p>
                                                        </div>
                                                        <div className="h-6 w-px bg-gray-100"></div>
                                                        <div className="text-center" title="Tasks Completed">
                                                            <p className="text-xs font-black text-gray-900">{row.stats.tasksCompleted}</p>
                                                            <p className="text-[10px] text-gray-400 uppercase font-medium">Tasks</p>
                                                        </div>
                                                        <div className="h-6 w-px bg-gray-100"></div>
                                                        <div className="text-center" title="On-time Completion Rate">
                                                            <p className="text-xs font-black text-indigo-600">
                                                                {row.stats.tasksCompleted > 0 
                                                                    ? Math.round((row.stats.onTimeTasks / row.stats.tasksCompleted) * 100) 
                                                                    : 0}%
                                                            </p>
                                                            <p className="text-[10px] text-gray-400 uppercase font-medium">Timing</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <div className="flex justify-center gap-2">
                                                        <span className="px-3 py-1 bg-green-50 text-green-700 text-[10px] font-bold rounded-lg border border-green-100" title="Attendance + Punctuality Pts">
                                                            {row.points.attendance + row.points.punctuality} A
                                                        </span>
                                                        <span className="px-3 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-lg border border-blue-100" title="Tasks + Timing Pts">
                                                            {row.points.tasks + row.points.timing} T
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 text-right">
                                                    <span className="text-2xl font-black text-indigo-900">{row.totalScore}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default Leaderboard;
