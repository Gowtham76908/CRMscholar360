const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const validate = require("../middleware/validate");
const { loginSchema } = require("../middleware/schemas");

router.post("/login",           validate(loginSchema), authController.login);
router.post("/logout",          authController.logout);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password",  authController.resetPassword);

module.exports = router;
