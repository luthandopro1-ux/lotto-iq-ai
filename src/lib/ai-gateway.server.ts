const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

export async function gatewayJson(
  system: string,
  user: string,
  model = "openai/gpt-5.6-sol",
): Promise<unknown> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured on this project.");

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
    },
    body: JSON.stringify({
      model,
      reasoning_effort: "none",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (res.status === 429) throw new Error("AI rate limit reached. Please try again in a moment.");
  if (res.status === 402)
    throw new Error("AI credits exhausted. Add credits to keep using AI features.");
  if (!res.ok) throw new Error(`AI request failed (${res.status}): ${await res.text()}`);

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("AI returned an unreadable response.");
  }
}
