const { getGroqClient, GROQ_DEFAULTS } = require("../config/groq");

/**
 * Handles AI Circuit Generation for Digital Logic.
 * Calls CircuitMind API (/generate then /export with gate_json), with internal Groq fallback.
 */
async function handleGenerateCircuit(req, res) {
  const { prompt = "", problem_title = "", problem_description = "" } = req.body || {};

  const userPrompt = (prompt || problem_description || problem_title || "make a logic circuit").trim();

  const circuitMindUrl = process.env.CIRCUITMIND_API_URL || "http://127.0.0.1:8000";
  const apiKey = process.env.CIRCUITMIND_API_KEY;

  // 1. Attempt to call CircuitMind API endpoint (/generate and /export)
  if (circuitMindUrl) {
    try {
      const headers = { "Content-Type": "application/json" };
      if (apiKey) {
        headers["X-API-Key"] = apiKey;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      // Step A: Generate circuit JSON
      const genResponse = await fetch(`${circuitMindUrl}/generate`, {
        method: "POST",
        headers,
        body: JSON.stringify({ prompt: userPrompt }),
        signal: controller.signal,
      });

      if (genResponse.ok) {
        const circuitJson = await genResponse.json();

        // Step B: Export to gate_json
        const exportResponse = await fetch(`${circuitMindUrl}/export`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            circuit_json: circuitJson,
            export_format: "gate_json",
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (exportResponse.ok) {
          const exportData = await exportResponse.json();
          const gateData = exportData.gate_json || {};
          return res.status(200).json({
            status: "success",
            circuit_name: circuitJson.circuit_name || "Generated Circuit",
            description: circuitJson.description || "",
            gates: gateData.gates || [],
            wires: gateData.wires || [],
            source: circuitJson.source || "circuitmind-api",
          });
        }
      }
      clearTimeout(timeoutId);
    } catch (err) {
      console.warn("[ai.handleGenerateCircuit] CircuitMind API proxy call failed/timed out, using internal fallback:", err.message);
    }
  }

  // 2. Fallback: Internal Groq generation
  const groqClient = getGroqClient();
  if (!groqClient) {
    return res.status(503).json({
      error: "AI circuit generation is temporarily unavailable. Please try again shortly.",
    });
  }

  try {
    const systemPrompt =
      "You are a digital logic circuit generator. Convert user requests into a gate JSON graph. " +
      "Reply ONLY with valid JSON containing 'gates' (list of {id, type, x, y, label}) and 'wires' (list of {id, fromId, toId, toIndex}). " +
      "Gate types must be: INPUT, OUTPUT, AND, OR, NOT, XOR, NAND, NOR.";

    const completion = await groqClient.chat.completions.create({
      model: GROQ_DEFAULTS.model,
      max_tokens: 600,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Generate logic circuit for: "${userPrompt}"` },
      ],
    });

    let cleanJson = (completion?.choices?.[0]?.message?.content || "").trim();
    if (cleanJson.startsWith("```")) {
      const parts = cleanJson.split("```");
      cleanJson = parts[1] ? parts[1].replace(/^json/, "").trim() : cleanJson;
    }

    const parsed = JSON.parse(cleanJson);
    return res.status(200).json({
      status: "success",
      circuit_name: userPrompt,
      gates: parsed.gates || [],
      wires: parsed.wires || [],
      source: "groq-fallback",
    });
  } catch (err) {
    console.error("[ai.handleGenerateCircuit] Fallback generation failed:", err?.message || err);
    return res.status(503).json({
      error: "Could not generate circuit right now. Please try again shortly.",
    });
  }
}

module.exports = { handleGenerateCircuit };
