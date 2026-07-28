const express = require("express");
const { requireAiAuth } = require("../ai/middleware/aiAuth");
const { aiChatRateLimiter } = require("../ai/middleware/aiRateLimit");
const { handleChat, handleChatStream } = require("../ai/controllers/chatController");
const { handleGetHint } = require("../ai/controllers/hintController");

const router = express.Router();


/**
 * @swagger
 * tags:
 *   name: AI Chat
 *   description: Endpoints for interacting with the AI assistant
 */

/**
 * @swagger
 * /api/ai/chat:
 *   post:
 *     summary: Send a message to the AI
 *     tags: [AI Chat]
 *     description: Sends a single prompt to the AI and returns the full generated response. Requires AI authentication.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message:
 *                 type: string
 *                 example: "Explain how a half adder works."
 *     responses:
 *       200:
 *         description: AI response generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     response:
 *                       type: string
 *       401:
 *         description: Unauthorized (AI auth missing or invalid)
 *       429:
 *         description: Rate limit exceeded
 */
router.post("/chat", requireAiAuth, aiChatRateLimiter, handleChat);

/**
 * @swagger
 * /api/ai/chat/stream:
 *   post:
 *     summary: Stream a message response from the AI
 *     tags: [AI Chat]
 *     description: Sends a prompt to the AI and streams the response back chunk-by-chunk using Server-Sent Events (SSE) or chunked transfer encoding.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message:
 *                 type: string
 *                 example: "Explain Boolean algebra."
 *     responses:
 *       200:
 *         description: Stream connection established
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *       401:
 *         description: Unauthorized (AI auth missing or invalid)
 *       429:
 *         description: Rate limit exceeded
 */
router.post("/chat/stream", requireAiAuth, aiChatRateLimiter, handleChatStream);

/**
 * @swagger
 * /api/ai/hint:
 *   post:
 *     summary: Get non-spoiler hint for a digital logic circuit
 *     tags: [AI Chat]
 *     description: Analyzes problem requirements and current canvas state to generate non-spoiler guidance.
 *     responses:
 *       200:
 *         description: Hint generated successfully
 *       401:
 *         description: Unauthorized
 *       429:
 *         description: Rate limit exceeded
 */
router.post("/hint", requireAiAuth, aiChatRateLimiter, handleGetHint);

module.exports = router;
