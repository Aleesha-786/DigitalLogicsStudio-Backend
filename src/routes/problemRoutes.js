const express = require("express");
const { protect, requireRole } = require("../middleware/authMiddleware");
const {
  listProblems,
  getProblem,
  createProblem,
  updateProblem,
  deleteProblem,
} = require("../controllers/problemController");

const router = express.Router();

router.use(protect);

router.get("/", listProblems);
router.get("/:id", getProblem);

router.post("/", requireRole("instructor", "admin"), createProblem);
router.put("/:id", requireRole("instructor", "admin"), updateProblem);
router.delete("/:id", requireRole("instructor", "admin"), deleteProblem);

module.exports = router;
