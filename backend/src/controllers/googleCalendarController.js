const { google } = require("googleapis");
const jwt = require("jsonwebtoken");
const prisma = require("../utils/prisma");
const { encrypt, decrypt } = require("../utils/encrypt");
const { ApiError } = require("../utils/apiError");

// OAuth `state` carries the initiating user's id, but the callback is public —
// so it must be tamper-proof. We sign it as a short-lived JWT and verify it on
// return, preventing an attacker from forging `state=<victimId>` (account-linking CSRF).
const STATE_TTL = "10m";
const signOAuthState = (userId) => jwt.sign({ uid: userId }, process.env.JWT_SECRET, { expiresIn: STATE_TTL });
const verifyOAuthState = (state) => {
    try {
        return jwt.verify(state, process.env.JWT_SECRET).uid || null;
    } catch {
        return null;
    }
};

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

function createOAuth2Client() {
    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );
}

// Retrieve and restore stored tokens for a user
async function getAuthorizedClient(userId) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
    const gcal = user?.preferences?.googleCalendar;
    if (!gcal?.refreshToken) {
        throw new ApiError(401, "GOOGLE_NOT_CONNECTED", "Google Calendar not connected. Please connect via Settings.");
    }

    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({
        refresh_token: decrypt(gcal.refreshToken),
        access_token: gcal.accessToken ? decrypt(gcal.accessToken) : undefined,
        expiry_date: gcal.expiresAt || undefined,
    });

    // Auto-refresh: re-fetch preferences fresh to avoid stale closure overwriting concurrent updates
    oauth2Client.on("tokens", async (tokens) => {
        const fresh = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
        const patch = { ...(fresh?.preferences || {}) };
        if (!patch.googleCalendar) patch.googleCalendar = {};
        if (tokens.access_token) patch.googleCalendar.accessToken = encrypt(tokens.access_token);
        if (tokens.expiry_date)  patch.googleCalendar.expiresAt  = tokens.expiry_date;
        await prisma.user.update({ where: { id: userId }, data: { preferences: patch } });
    });

    return oauth2Client;
}

// GET /api/google/auth
const initiateAuth = (req, res) => {
    const oauth2Client = createOAuth2Client();
    const url = oauth2Client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: SCOPES,
        state: signOAuthState(req.user.userId),
    });
    res.json({ url });
};

// GET /api/google/callback  (public — no authMiddleware, state carries userId)
const handleCallback = async (req, res, next) => {
    try {
        const { code, state, error } = req.query;

        if (error) {
            return res.redirect(`${process.env.FRONTEND_URL}/settings?gcal=denied`);
        }
        const userId = verifyOAuthState(state);
        if (!code || !userId) {
            return res.redirect(`${process.env.FRONTEND_URL}/settings?gcal=error`);
        }

        const oauth2Client = createOAuth2Client();
        const { tokens } = await oauth2Client.getToken(code);

        if (!tokens.refresh_token) {
            return res.redirect(`${process.env.FRONTEND_URL}/settings?gcal=no_refresh_token`);
        }

        const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
        const existing = user?.preferences || {};

        await prisma.user.update({
            where: { id: userId },
            data: {
                preferences: {
                    ...existing,
                    googleCalendar: {
                        refreshToken: encrypt(tokens.refresh_token),
                        accessToken: tokens.access_token ? encrypt(tokens.access_token) : null,
                        expiresAt: tokens.expiry_date || null,
                        connectedAt: new Date().toISOString(),
                    },
                },
            },
        });

        res.redirect(`${process.env.FRONTEND_URL}/settings?gcal=connected`);
    } catch (err) {
        return next(err);
    }
};

// POST /api/google/calendar/disconnect
const disconnect = async (req, res, next) => {
    try {
        const { userId } = req.user;
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
        const prefs = { ...(user?.preferences || {}) };
        delete prefs.googleCalendar;
        await prisma.user.update({ where: { id: userId }, data: { preferences: prefs } });
        res.json({ message: "Google Calendar disconnected." });
    } catch (err) {
        return next(err);
    }
};

// GET /api/google/calendar/status
const getStatus = async (req, res, next) => {
    try {
        const { userId } = req.user;
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
        const gcal = user?.preferences?.googleCalendar;
        res.json({
            connected: !!gcal?.refreshToken,
            connectedAt: gcal?.connectedAt || null,
        });
    } catch (err) {
        return next(err);
    }
};

// POST /api/google/calendar/events  — create a calendar event for a reminder
const createEvent = async (req, res, next) => {
    try {
        const { userId } = req.user;
        const { summary, description, startTime, endTime, reminderId, leadId, taskId } = req.body;

        if (!summary || !startTime) {
            throw new ApiError(400, "VALIDATION_ERROR", "summary and startTime are required");
        }

        const auth = await getAuthorizedClient(userId);
        const calendar = google.calendar({ version: "v3", auth });

        const start = new Date(startTime);
        const end = endTime ? new Date(endTime) : new Date(start.getTime() + 30 * 60 * 1000); // 30m default

        const event = {
            summary,
            description: description || "",
            start: { dateTime: start.toISOString(), timeZone: "Asia/Kolkata" },
            end: { dateTime: end.toISOString(), timeZone: "Asia/Kolkata" },
            reminders: {
                useDefault: false,
                overrides: [
                    { method: "popup", minutes: 10 },
                    { method: "email", minutes: 30 },
                ],
            },
        };

        const { data } = await calendar.events.insert({ calendarId: "primary", requestBody: event });

        // If linked to a reminder, persist the event ID for later deletion.
        if (reminderId) {
            await prisma.reminder.updateMany({
                where: { id: reminderId },
                data:  { gcalEventId: data.id },
            });
        }

        res.status(201).json({
            eventId: data.id,
            htmlLink: data.htmlLink,
            summary: data.summary,
            start: data.start,
        });
    } catch (err) {
        return next(err);
    }
};

// DELETE /api/google/calendar/events/:eventId
const deleteEvent = async (req, res, next) => {
    try {
        const { userId } = req.user;
        const { eventId } = req.params;

        const auth = await getAuthorizedClient(userId);
        const calendar = google.calendar({ version: "v3", auth });

        await calendar.events.delete({ calendarId: "primary", eventId });
        res.json({ message: "Event deleted from Google Calendar." });
    } catch (err) {
        if (err.code === 410 || err.status === 410) {
            // Already deleted — treat as success
            return res.json({ message: "Event already removed." });
        }
        return next(err);
    }
};

// GET /api/google/calendar/events  — list upcoming events
const listEvents = async (req, res, next) => {
    try {
        const { userId } = req.user;
        // Clamp to 1–90 days so a huge `days` can't request an unbounded window.
        const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 90);

        const auth = await getAuthorizedClient(userId);
        const calendar = google.calendar({ version: "v3", auth });

        const timeMin = new Date().toISOString();
        const timeMax = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

        const { data } = await calendar.events.list({
            calendarId: "primary",
            timeMin,
            timeMax,
            maxResults: 50,
            singleEvents: true,
            orderBy: "startTime",
        });

        res.json({ events: data.items || [] });
    } catch (err) {
        return next(err);
    }
};

module.exports = { initiateAuth, handleCallback, disconnect, getStatus, createEvent, deleteEvent, listEvents };
