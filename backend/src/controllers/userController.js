const prisma = require("../utils/prisma");
const bcrypt = require("bcrypt");
const normalizePhone = require("../utils/normalizePhone");
const { toSafeUser } = require("../utils/safeUser");

const registerUser = async (req, res, next) => {
    try {
        const { name, email, phone, password, role, department } = req.body;

        if (!name || !email || !password) {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Name, email, and password are required");
        }

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "User already exists");
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await prisma.user.create({
            data: {
                name,
                email,
                phone,
                phoneNormalized: normalizePhone(phone),
                password: hashedPassword,
                role: role || "EMPLOYEE",
                department
            }
        });

        res.status(201).json({ message: "User registered successfully", user: toSafeUser(newUser) });

    } catch (error) {
        return next(error);
    }
};

// Update Profile
const updateProfile = async (req, res, next) => {
    try {
        const userId = req.user.userId; // properly extracted from token
        const { name, phone, department } = req.body;

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { name, phone, phoneNormalized: normalizePhone(phone), department }
        });

        res.json(toSafeUser(updatedUser));
    } catch (error) {
        return next(error);
    }
};

// Change Password
const changePassword = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { currentPassword, newPassword } = req.body;

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new ApiError(404, ERROR_CODES.NOT_FOUND, "User not found");

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Incorrect current password");

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword }
        });

        res.json({ message: "Password updated successfully" });
    } catch (error) {
        return next(error);
    }
};

// Update Preferences
const updatePreferences = async (req, res, next) => {
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
        return next(error);
    }
};

// Get all users (for admin/manager selection)
const getAllUsers = async (req, res, next) => {
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

        return next(error);
    }
};

module.exports = {
    registerUser,
    updateProfile,
    changePassword,
    updatePreferences,
    getAllUsers
};
