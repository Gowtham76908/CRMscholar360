const prisma = require("../utils/prisma");
const bcrypt = require("bcrypt");

const registerUser = async (req, res) => {
    try {
        const { name, email, phone, password, role, department } = req.body;

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await prisma.user.create({
            data: {
                name,
                email,
                phone,
                password: hashedPassword,
                role: role || "EMPLOYEE",
                department
            }
        });

        const { password: _, ...userWithoutPassword } = newUser;

        res.status(201).json({ message: "User registered successfully", user: userWithoutPassword });

    } catch (error) {
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

// Update Profile
const updateProfile = async (req, res) => {
    try {
        const userId = req.user.userId; // properly extracted from token
        const { name, phone, department } = req.body;

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { name, phone, department },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
                department: true,
                profilePhoto: true,
                preferences: true
            }
        });

        res.json(updatedUser);
    } catch (error) {
        res.status(500).json({ message: "Error updating profile", error: error.message });
    }
};

// Change Password
const changePassword = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { currentPassword, newPassword } = req.body;

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ message: "User not found" });

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) return res.status(400).json({ message: "Incorrect current password" });

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword }
        });

        res.json({ message: "Password updated successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error changing password", error: error.message });
    }
};

// Update Preferences
const updatePreferences = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { preferences } = req.body;

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { preferences },
            select: { preferences: true }
        });

        res.json(updatedUser);
    } catch (error) {
        res.status(500).json({ message: "Error updating preferences", error: error.message });
    }
};

// Get all users (for admin/manager selection)
const getAllUsers = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            where: { isActive: true },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                department: true
            },
            orderBy: { name: 'asc' }
        });

        res.json(users);
    } catch (error) {
        console.error("Get users error:", error);
        res.status(500).json({ message: "Failed to fetch users" });
    }
};

module.exports = {
    registerUser,
    updateProfile,
    changePassword,
    updatePreferences,
    getAllUsers
};
