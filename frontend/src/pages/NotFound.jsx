import { useNavigate } from "react-router-dom";
import { Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
    const navigate = useNavigate();

    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
            <p className="text-8xl font-extrabold text-indigo-600">404</p>
            <h1 className="mt-4 text-2xl font-bold text-gray-900">Page not found</h1>
            <p className="mt-2 text-sm text-gray-500 max-w-sm">
                The page you're looking for doesn't exist or has been moved.
            </p>
            <div className="mt-8 flex gap-3">
                <button
                    onClick={() => navigate(-1)}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Go back
                </button>
                <button
                    onClick={() => navigate("/dashboard")}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                >
                    <Home className="h-4 w-4" />
                    Dashboard
                </button>
            </div>
        </div>
    );
}
