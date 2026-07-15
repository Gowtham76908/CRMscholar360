import { Component } from "react";

export default class ErrorBoundary extends Component {
    state = { hasError: false, message: "" };

    static getDerivedStateFromError(error) {
        return { hasError: true, message: error?.message || "Unknown error" };
    }

    componentDidCatch(error, info) {
        console.error("[ErrorBoundary]", error, info.componentStack);
        
        // Detect chunk loading errors (caused by new deployments)
        const isChunkError = 
            /failed to fetch dynamically imported module/i.test(error?.message) ||
            /loading chunk/i.test(error?.message);
            
        if (isChunkError) {
            console.log("[ErrorBoundary] Chunk load error detected. Reloading page...");
            window.location.reload(true);
        }
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center px-6">
                    <div className="bg-red-50 border border-red-200 rounded-xl p-8 max-w-md w-full">
                        <h2 className="text-lg font-semibold text-red-800 mb-2">Something went wrong</h2>
                        <p className="text-sm text-red-600 mb-6">{this.state.message}</p>
                        <button
                            onClick={() => this.setState({ hasError: false, message: "" })}
                            className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}
