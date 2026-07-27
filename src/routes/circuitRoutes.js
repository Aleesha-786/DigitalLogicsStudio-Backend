const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const {
  saveCircuit,
  updateCircuit,
  listCircuits,
  getCircuit,
  deleteCircuit,
} = require("../controllers/circuitController");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: TrainerBoard
 *   description: Save/load endpoints for the Digital Logic Trainer Board
 */

// Every trainer-board circuit endpoint requires a logged-in user — there's
// no anonymous save, matching how the frontend gates the Save button behind
// isAuthenticated and routes to /login otherwise.
router.use(protect);

/**
 * @swagger
 * /api/trainer-board/circuits:
 *   get:
 *     summary: List the authenticated user's saved circuits
 *     tags: [TrainerBoard]
 *     responses:
 *       200:
 *         description: List of saved circuit summaries
 *       401:
 *         description: Not authenticated
 */
router.get("/circuits", listCircuits);

/**
 * @swagger
 * /api/trainer-board/circuits:
 *   post:
 *     summary: Save a new circuit
 *     tags: [TrainerBoard]
 *     responses:
 *       201:
 *         description: Circuit saved
 *       400:
 *         description: Invalid payload
 *       401:
 *         description: Not authenticated
 */
router.post("/circuits", saveCircuit);

/**
 * @swagger
 * /api/trainer-board/circuits/{id}:
 *   get:
 *     summary: Get one saved circuit
 *     tags: [TrainerBoard]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The saved circuit
 *       404:
 *         description: Not found / not owned by this user
 *       401:
 *         description: Not authenticated
 */
router.get("/circuits/:id", getCircuit);

/**
 * @swagger
 * /api/trainer-board/circuits/{id}:
 *   put:
 *     summary: Overwrite an existing saved circuit
 *     tags: [TrainerBoard]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Circuit updated
 *       404:
 *         description: Not found / not owned by this user
 *       401:
 *         description: Not authenticated
 */
router.put("/circuits/:id", updateCircuit);

/**
 * @swagger
 * /api/trainer-board/circuits/{id}:
 *   delete:
 *     summary: Delete a saved circuit
 *     tags: [TrainerBoard]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Circuit deleted
 *       404:
 *         description: Not found / not owned by this user
 *       401:
 *         description: Not authenticated
 */
router.delete("/circuits/:id", deleteCircuit);

module.exports = router;
