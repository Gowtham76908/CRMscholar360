const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const prisma = require("../utils/prisma");
const bcrypt = require("bcrypt");
const { notifyIfLeaderboardWinner } = require("../services/notificationService");
const { toSafeUser } = require("../utils/safeUser");
const { sendEmail } = require("../services/emailService");
const { ERROR_CODES } = require("../utils/apiError");

const RESET_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
const MIN_RESPONSE_MS   = 400;             // constant-time floor for forgot-password

const hashToken = (raw) => crypto.createHash("sha256").update(raw).digest("hex");

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            return res.status(401).json({ error: { code: ERROR_CODES.AUTH_INVALID_CREDENTIALS, message: "Invalid credentials" } });
        }

        if (!user.isActive) {
            return res.status(403).json({ error: { code: ERROR_CODES.AUTH_ACCOUNT_INACTIVE, message: "Account is inactive. Contact your administrator." } });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ error: { code: ERROR_CODES.AUTH_INVALID_CREDENTIALS, message: "Invalid credentials" } });
        }

        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) throw new Error("JWT_SECRET is not set in environment variables");

        const token = jwt.sign(
            { userId: user.id, role: user.role },
            jwtSecret,
            { expiresIn: "7d" }
        );

        const isProd = process.env.NODE_ENV === "production";
        res.cookie("token", token, {
            httpOnly: true,
            secure:   isProd,
            sameSite: isProd ? "none" : "lax",
            maxAge:   7 * 24 * 60 * 60 * 1000,
            path:     "/",
        });

        res.json({ message: "Login successful", user: toSafeUser(user) });

        // Fire-and-forget: on the 1st of every month, notify the winner of last month's leaderboard
        notifyIfLeaderboardWinner(user.id).catch(err =>
            console.error("[Login] Leaderboard winner check failed:", err)
        );

    } catch (error) {
        res.status(500).json({
            message: "Login failed",
            error: error.message
        });
    }
};

const forgotPassword = async (req, res) => {
    const start = Date.now();
    // Always respond with the same message — never reveal whether the email exists
    const SAFE_RESPONSE = { message: "If that email is registered, a reset link has been sent." };

    try {
        const { email } = req.body;
        if (!email) {
            await _delay(start);
            return res.json(SAFE_RESPONSE);
        }

        const user = await prisma.user.findUnique({ where: { email } });

        if (user && user.isActive) {
            const rawToken = crypto.randomBytes(32).toString("hex");
            const hashed   = hashToken(rawToken);
            const expiry   = new Date(Date.now() + RESET_TOKEN_TTL_MS);

            // Overwrite any previous token — only the latest link is valid
            await prisma.user.update({
                where: { id: user.id },
                data: { resetToken: hashed, resetTokenExpiry: expiry },
            });

            const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${rawToken}`;

            void sendEmail({
                to: email,
                subject: "Reset your D-CRM password",
                html: `
                    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px">
                        <h2 style="color:#4f46e5">Password reset request</h2>
                        <p>Hi ${user.name},</p>
                        <p>We received a request to reset your D-CRM password. Click the button below to choose a new one.</p>
                        <a href="${resetUrl}"
                           style="display:inline-block;margin:16px 0;padding:12px 24px;background:#4f46e5;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">
                            Reset password
                        </a>
                        <p style="color:#6b7280;font-size:13px">This link expires in <strong>15 minutes</strong>. After that you'll need to request a new one.</p>
                        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
                        <p style="color:#9ca3af;font-size:12px">If you didn't request a password reset, you can safely ignore this email — your password won't change.</p>
                    </div>`,
                text: `Reset your D-CRM password\n\nHi ${user.name},\n\nClick the link below to reset your password (expires in 15 minutes):\n${resetUrl}\n\nIf you didn't request this, ignore this email.`,
            }).catch(err => console.error("[ForgotPassword] Email send failed:", err));
            // void above ensures the promise rejection is handled — no unhandled-rejection warning
        }
    } catch (error) {
        console.error("[ForgotPassword] Error:", error);
        // Fall through — still return the safe response so errors don't reveal anything
    }

    await _delay(start);
    res.json(SAFE_RESPONSE);
};

const resetPassword = async (req, res) => {
    try {
        const { token, password } = req.body;

        if (!token || !password) {
            return res.status(400).json({ code: "MISSING_FIELDS", message: "Token and new password are required." });
        }
        if (password.length < 8) {
            return res.status(400).json({ code: "PASSWORD_TOO_SHORT", message: "Password must be at least 8 characters." });
        }
        if (!/[0-9]/.test(password)) {
            return res.status(400).json({ code: "PASSWORD_WEAK", message: "Password must contain at least one number." });
        }

        const hashed = hashToken(token);
        const user = await prisma.user.findFirst({
            where: {
                resetToken:       hashed,
                resetTokenExpiry: { gt: new Date() },
            },
        });

        if (!user) {
            return res.status(400).json({ code: "RESET_TOKEN_INVALID", message: "This reset link is invalid or has expired. Please request a new one." });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        await prisma.$transaction([
            prisma.user.update({
                where: { id: user.id },
                data: { password: hashedPassword, resetToken: null, resetTokenExpiry: null },
            }),
            prisma.session.deleteMany({ where: { userId: user.id } }),
        ]);

        res.json({ code: "PASSWORD_RESET", message: "Password reset successfully. Please log in with your new password." });

        // Fire-and-forget security alert — void prevents unhandled-rejection warnings
        const resetTime = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
        void sendEmail({
            to: user.email,
            subject: "Your D-CRM password was changed",
            html: `
                <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px">
                    <h2 style="color:#4f46e5">Password changed</h2>
                    <p>Hi ${user.name},</p>
                    <p>Your D-CRM password was successfully changed on <strong>${resetTime} IST</strong>.</p>
                    <p style="color:#dc2626;font-weight:600">If you did not make this change, contact your administrator immediately and secure your email account.</p>
                    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
                    <p style="color:#9ca3af;font-size:12px">This is an automated security alert from D-CRM.</p>
                </div>`,
            text: `Hi ${user.name},\n\nYour D-CRM password was changed on ${resetTime} IST.\n\nIf you did not do this, contact your administrator immediately.\n\nD-CRM Security`,
        }).catch(err => console.error("[ResetPassword] Alert email failed:", err));
    } catch (error) {
        console.error("[ResetPassword] Error:", error);
        res.status(500).json({ code: "RESET_FAILED", message: "Failed to reset password. Please try again." });
    }
};

// Ensures forgot-password responses always take at least MIN_RESPONSE_MS
// regardless of whether the email was found — prevents timing-based enumeration
const _delay = (start) => {
    const elapsed = Date.now() - start;
    const wait    = Math.max(0, MIN_RESPONSE_MS - elapsed);
    return new Promise((r) => setTimeout(r, wait));
};

const logout = (req, res) => {
    const isProd = process.env.NODE_ENV === "production";
    res.clearCookie("token", {
        httpOnly: true,
        secure:   isProd,
        sameSite: isProd ? "none" : "lax",
        path:     "/",
    });
    res.json({ message: "Logged out" });
};

module.exports = { login, logout, forgotPassword, resetPassword };
