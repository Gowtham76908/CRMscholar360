// Resolve a possibly-relative upload URL to an absolute URL on the API origin.
//
// Locally-stored files come back as relative paths like
// "/uploads/resumes/x.pdf?token=…". A bare <a href> would resolve those against
// the frontend origin (e.g. the Vercel app), which has no such file and bounces
// to /login. Prefixing the API origin points them at the backend that serves them.
//
// Absolute http(s) URLs (e.g. Cloudinary) are returned unchanged.
const API_ORIGIN = (import.meta.env.VITE_API_URL || "").replace(/\/api\/?$/, "");

export function fileUrl(url) {
    if (!url) return url;
    if (/^https?:\/\//i.test(url)) return url;
    return `${API_ORIGIN}${url.startsWith("/") ? "" : "/"}${url}`;
}
