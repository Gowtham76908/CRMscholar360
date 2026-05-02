const jwt = require("jsonwebtoken");
const prisma = require("../utils/prisma");
const bcrypt = require("bcrypt");
const { notifyIfLeaderboardWinner } = require("../services/notificationService");

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        if (!user.isActive) {
            return res.status(403).json({ message: "Access denied. User is inactive." });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const token = jwt.sign(
            { userId: user.id, role: user.role },
            process.env.JWT_SECRET || "fallback_secret",
            { expiresIn: "7d" }
        );

        res.json({
            message: "Login successful",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                phone: user.phone,
                department: user.department,
                createdAt: user.createdAt
            }
        });

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

module.exports = { login };
