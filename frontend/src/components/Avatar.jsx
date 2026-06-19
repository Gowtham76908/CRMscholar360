import { User } from "lucide-react";

const STATUS_DOT = {
    ONLINE:  "bg-green-500 ring-2 ring-green-200",
    BREAK:   "bg-yellow-400",
    OFFLINE: "bg-red-500",
};

const Avatar = ({ user, size = "md", className = "", status = null }) => {
    const sizes = {
        xs:   "w-6 h-6 text-xs",
        sm:   "w-8 h-8 text-sm",
        md:   "w-10 h-10 text-base",
        lg:   "w-12 h-12 text-lg",
        xl:   "w-16 h-16 text-xl",
        "2xl": "w-20 h-20 text-2xl"
    };

    const dotSizes = {
        xs:   "w-1.5 h-1.5 border",
        sm:   "w-2 h-2 border",
        md:   "w-2.5 h-2.5 border-2",
        lg:   "w-3 h-3 border-2",
        xl:   "w-3.5 h-3.5 border-2",
        "2xl": "w-4 h-4 border-2"
    };

    const getInitials = (name) => {
        if (!name) return "U";
        const parts = name.split(" ");
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name[0].toUpperCase();
    };

    const backendUrl = import.meta.env.VITE_API_BASE_URL;
    const photoUrl = user?.profilePhoto
        ? (user.profilePhoto.startsWith("http://") || user.profilePhoto.startsWith("https://") || user.profilePhoto.startsWith("//")
            ? user.profilePhoto
            : `${backendUrl}${user.profilePhoto}`)
        : null;

    return (
        <div className={`relative ${sizes[size]} rounded-full overflow-visible flex-shrink-0 ${className}`}>
            <div className={`${sizes[size]} rounded-full overflow-hidden`}>
                {photoUrl ? (
                    <img
                        src={photoUrl}
                        alt={user.name || "User"}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            e.target.style.display = "none";
                            e.target.parentElement.innerHTML = `
                                <div class="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold">
                                    ${getInitials(user.name)}
                                </div>
                            `;
                        }}
                    />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold">
                        {user?.name ? getInitials(user.name) : <User className="w-1/2 h-1/2" />}
                    </div>
                )}
            </div>

            {/* Status dot */}
            {status && STATUS_DOT[status] && (
                <span
                    className={`absolute bottom-0 right-0 ${dotSizes[size]} rounded-full border-white ${STATUS_DOT[status]}`}
                    title={status.charAt(0) + status.slice(1).toLowerCase()}
                />
            )}
        </div>
    );
};

export default Avatar;
