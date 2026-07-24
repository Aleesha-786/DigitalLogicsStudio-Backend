const express = require("express");
const rateLimit = require("express-rate-limit");
const {
  registerUser,
  loginUser,
  logoutUser,
  getCurrentUser,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  updateNotificationPreferences,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many attempts. Please try again later.",
  },
});

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: User registration, login, logout, and session management
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 example: Saad Amin
 *               email:
 *                 type: string
 *                 format: email
 *                 example: saad@example.com
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: mySecret123
 *     responses:
 *       201:
 *         description: Account created successfully. Sets an httpOnly auth cookie.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       400:
 *         description: Validation error (missing fields, invalid email, short password, etc.)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Email already in use
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/register", registerUser);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Log in with email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: saad@example.com
 *               password:
 *                 type: string
 *                 example: mySecret123
 *     responses:
 *       200:
 *         description: Login successful. Sets an httpOnly auth cookie.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       400:
 *         description: Missing email or password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/login", loginUser);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Log out the current user
 *     tags: [Auth]
 *     description: Clears the httpOnly auth cookie.
 *     responses:
 *       200:
 *         description: Logged out successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 */
router.post("/logout", logoutUser);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get the currently authenticated user
 *     tags: [Auth]
 *     description: >
 *       Requires a valid session cookie. In Swagger UI, call POST /api/auth/login
 *       first — the browser will forward the cookie automatically.
 *     responses:
 *       200:
 *         description: Current user data
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/me", protect, getCurrentUser);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Request a password reset code via email
 *     tags: [Auth]
 *     description: >
 *       Sends a 6-digit OTP to the user's email if an account exists. Always
 *       returns 200 with a generic message to avoid revealing whether the
 *       email is registered.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: OTP sent (or email not found — response is identical either way)
 *       400:
 *         description: Invalid email
 */
router.post("/forgot-password", otpRequestLimiter, forgotPassword);

/**
 * @swagger
 * /api/auth/verify-reset-otp:
 *   post:
 *     summary: Verify the password reset OTP
 *     tags: [Auth]
 *     description: >
 *       Verifies the 6-digit code sent to the user's email. On success,
 *       returns a short-lived resetToken required to call /reset-password.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: OTP verified, resetToken issued
 *       400:
 *         description: Invalid or expired code
 *       429:
 *         description: Too many incorrect attempts
 */
router.post("/verify-reset-otp", otpVerifyLimiter, verifyResetOtp);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Set a new password using a verified reset token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, resetToken, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               resetToken:
 *                 type: string
 *               password:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Invalid/expired reset session or weak password
 */
router.post("/reset-password", otpVerifyLimiter, resetPassword);

/**
 * @swagger
 * /api/auth/notifications:
 *   patch:
 *     summary: Toggle email notification opt-out for the current user
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [optedOut]
 *             properties:
 *               optedOut:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Preference updated
 *       401:
 *         description: Not authorized
 */
router.patch("/notifications", protect, updateNotificationPreferences);

module.exports = router;
