const mongoose = require("mongoose");

// ─── Sub-schemas ─────────────────────────────────────────────────────────────
// Kept loose (Mixed) for wires/placedICs/switches — this is a snapshot of
// frontend state (breadboard wiring + placed ICs + switch positions), not
// something the backend needs to validate field-by-field. The frontend
// owns the shape; the backend just persists and returns it verbatim.

const wireSchema = new mongoose.Schema(
  {
    id: { type: mongoose.Schema.Types.Mixed },
    from: { type: String, required: true },
    to: { type: String, required: true },
    ax: Number,
    ay: Number,
    bx: Number,
    by: Number,
    color: String,
  },
  { _id: false },
);

const placedIcSchema = new mongoose.Schema(
  {
    id: { type: mongoose.Schema.Types.Mixed },
    ic: { type: mongoose.Schema.Types.Mixed, required: true }, // IC catalog key, e.g. 7400
    x: Number,
    y: Number,
    col: Number,
  },
  { _id: false },
);

// ─── Main SavedCircuit schema ─────────────────────────────────────────────────

const savedCircuitSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "Untitled Circuit",
    },
    wires: { type: [wireSchema], default: [] },
    placedICs: { type: [placedIcSchema], default: [] },
    switches: { type: [Number], default: () => Array(8).fill(0) },
    clkHz: { type: Number, default: 1 },
    clkOn: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Most-recently-updated first is the natural listing order for "your saved circuits".
savedCircuitSchema.index({ userId: 1, updatedAt: -1 });

savedCircuitSchema.statics.findOwnedById = function (id, userId) {
  return this.findOne({ _id: id, userId });
};

module.exports = mongoose.model("SavedCircuit", savedCircuitSchema);
