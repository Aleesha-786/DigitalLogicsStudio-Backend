const { createHttpError } = require("../utils/httpError");
const SavedCircuit = require("../models/SavedCircuit");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readCircuitPayload(body = {}) {
  const { name = "Untitled Circuit", wires = [], placedICs = [], switches, clkHz = 1, clkOn = true } = body;

  if (!Array.isArray(wires) || !Array.isArray(placedICs)) {
    throw createHttpError(400, "wires and placedICs must be arrays.");
  }

  const normalizedSwitches = Array.isArray(switches) && switches.length
    ? switches.map((v) => (v ? 1 : 0))
    : Array(8).fill(0);

  return {
    name: String(name).trim().slice(0, 80) || "Untitled Circuit",
    wires,
    placedICs,
    switches: normalizedSwitches,
    clkHz: Number(clkHz) || 1,
    clkOn: Boolean(clkOn),
  };
}

function sanitizeCircuit(doc) {
  return {
    id: doc._id,
    name: doc.name,
    wires: doc.wires,
    placedICs: doc.placedICs,
    switches: doc.switches,
    clkHz: doc.clkHz,
    clkOn: doc.clkOn,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function summarizeCircuit(doc) {
  return {
    id: doc._id,
    name: doc.name,
    wireCount: doc.wires?.length || 0,
    icCount: doc.placedICs?.length || 0,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * POST /api/trainer-board/circuits
 * Create a new saved circuit for the authenticated user.
 */
async function saveCircuit(req, res, next) {
  try {
    const payload = readCircuitPayload(req.body);
    const doc = await SavedCircuit.create({ userId: req.user._id, ...payload });

    res.status(201).json({
      success: true,
      message: "Circuit saved.",
      circuit: sanitizeCircuit(doc),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/trainer-board/circuits/:id
 * Overwrite an existing saved circuit owned by the authenticated user.
 */
async function updateCircuit(req, res, next) {
  try {
    const { id } = req.params;
    const payload = readCircuitPayload(req.body);

    const doc = await SavedCircuit.findOwnedById(id, req.user._id);
    if (!doc) {
      throw createHttpError(404, "Saved circuit not found.");
    }

    Object.assign(doc, payload);
    await doc.save();

    res.status(200).json({
      success: true,
      message: "Circuit updated.",
      circuit: sanitizeCircuit(doc),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/trainer-board/circuits
 * List the authenticated user's saved circuits (summaries only — no
 * wires/placedICs payload, to keep the list endpoint light).
 */
async function listCircuits(req, res, next) {
  try {
    const docs = await SavedCircuit.find({ userId: req.user._id }).sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      circuits: docs.map(summarizeCircuit),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/trainer-board/circuits/:id
 * Fetch one full saved circuit (with wires/placedICs) owned by the user.
 */
async function getCircuit(req, res, next) {
  try {
    const { id } = req.params;
    const doc = await SavedCircuit.findOwnedById(id, req.user._id);
    if (!doc) {
      throw createHttpError(404, "Saved circuit not found.");
    }

    res.status(200).json({
      success: true,
      circuit: sanitizeCircuit(doc),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/trainer-board/circuits/:id
 */
async function deleteCircuit(req, res, next) {
  try {
    const { id } = req.params;
    const doc = await SavedCircuit.findOwnedById(id, req.user._id);
    if (!doc) {
      throw createHttpError(404, "Saved circuit not found.");
    }

    await doc.deleteOne();

    res.status(200).json({
      success: true,
      message: "Circuit deleted.",
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  saveCircuit,
  updateCircuit,
  listCircuits,
  getCircuit,
  deleteCircuit,
};
