const { getGroqClient, GROQ_DEFAULTS } = require("../config/groq");

/**
 * Handles hint generation for digital logic circuits.
 * Proxies to CircuitMind API on Vercel if configured, with a local Groq fallback.
 */
async function handleGetHint(req, res) {
  const {
    problem_title = "",
    problem_description = "",
    inputs = [],
    outputs = [],
    truth_table = [],
    gates = [],
    wires = [],
    last_result = null,
  } = req.body || {};

  const circuitMindUrl = process.env.CIRCUITMIND_API_URL || "http://127.0.0.1:8000";
  const apiKey = process.env.CIRCUITMIND_API_KEY;

  // 1. Attempt to call CircuitMind API endpoint
  if (circuitMindUrl) {
    try {
      const headers = { "Content-Type": "application/json" };
      if (apiKey) {
        headers["X-API-Key"] = apiKey;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(`${circuitMindUrl}/hint`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          problem_title,
          problem_description,
          inputs,
          outputs,
          truth_table,
          gates,
          wires,
          last_result,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        return res.status(200).json({
          reply: data.hint,
          hint: data.hint,
          source: data.source || "circuitmind-api",
        });
      }
    } catch (err) {
      console.warn("[ai.handleGetHint] CircuitMind API proxy call failed/timed out, using internal fallback:", err.message);
    }
  }

  // 2. Fallback: Generate hint via internal Groq client
  const groqClient = getGroqClient();
  if (!groqClient) {
    return res.status(503).json({
      error: "AI hint service is temporarily unavailable. Please try again shortly.",
    });
  }

  try {
    const hintSystemPrompt =
      "You are a digital logic design tutor. A student is building a combinational or sequential logic circuit " +
      "trying to match a problem requirement. Reply with exactly ONE short hint (2-4 sentences, plain English) " +
      "that nudges the student toward the fix. Point at the kind of mistake or the next concept to apply — " +
      "do NOT give the full gate list or wiring diagram. Be specific to their current circuit.";

    const gateSummary = Array.isArray(gates) && gates.length > 0
      ? gates.map((g) => `${g.label || g.type || "gate"} (${g.type || "logic"})`).join(", ")
      : "no gates placed yet";

    const userPrompt = [
      `Problem: ${problem_title || "Digital Logic Circuit Problem"}`,
      problem_description ? `Description: ${problem_description}` : "",
      inputs.length > 0 ? `Required Inputs: ${inputs.join(", ")}` : "",
      outputs.length > 0 ? `Required Outputs: ${outputs.join(", ")}` : "",
      `Current Gates: ${gateSummary}`,
      `Current Wires: ${Array.isArray(wires) ? wires.length : 0} wire(s)`,
      last_result?.failing_rows ? `Failing Test Rows: ${JSON.stringify(last_result.failing_rows.slice(0, 3))}` : "",
    ].filter(Boolean).join("\n");

    const completion = await groqClient.chat.completions.create({
      model: GROQ_DEFAULTS.model,
      max_tokens: 250,
      temperature: 0.4,
      messages: [
        { role: "system", content: hintSystemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const reply = completion?.choices?.[0]?.message?.content?.trim();
    return res.status(200).json({
      reply: reply || "Check your gate types and ensure all inputs and outputs are properly wired.",
      hint: reply,
      source: "groq-fallback",
    });
  } catch (err) {
    console.error("[ai.handleGetHint] Fallback hint generation failed:", err?.message || err);
    return res.status(503).json({
      error: "Could not generate hint right now. Please try again shortly.",
    });
  }
}

module.exports = { handleGetHint };
