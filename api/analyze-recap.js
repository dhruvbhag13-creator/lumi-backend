import OpenAI from "openai";

export const config = {
  runtime: "edge",
};

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req) {
  try {
    const body = await req.json();
    const { slides, caption } = body || {};

    if (!slides || !Array.isArray(slides) || slides.length === 0) {
      return new Response(
        JSON.stringify({ error: "No slides provided" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `
You are Lumi's recap brain.

You will receive:
- A user caption describing a week, month, trip, or event.
- A list of image URLs (photos from their camera roll).

Your job is to analyze them and output JSON with this EXACT shape:

{
  "vibeKey": "hype" | "cozy" | "travel" | "friends" | "chill" | "default",
  "vibeLabel": "string",
  "title": "string",
  "description": "string",
  "orderedSlides": [{ "uri": "..." }, ...],
  "highlights": [0, 3, 5]
}

Rules:
- "orderedSlides" must contain ALL slides, same URIs as input, but in better story order.
- "highlights" must be 2–5 indices into orderedSlides (0-based) for the best / most aesthetic photos.
- "vibeKey" is a simple bucket. If unsure, use "default".
- "vibeLabel" is human readable (e.g. "hype night", "cozy weekend", "travel vibes").
- "title" should be short and aesthetic (like a recap title).
- "description" is 1 sentence describing the vibe (max ~140 chars).

If the caption is empty or generic, lean more on the images.
If the caption is specific ("girls trip in Miami"), use that in the title/description.
Return ONLY the JSON object, no explanation.
`;

    const response = await client.responses.create({
      model: "gpt-4o-mini",
      text: { format: "json" },
      input: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Caption: ${caption || ""}`,
            },
            ...slides.map((s) => ({
              type: "input_image",
              image_url: s.uri,
            })),
          ],
        },
      ],
    });

    const jsonText = response.output[0].content[0].text;

    return new Response(jsonText, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-recap error:", e);
    return new Response(
      JSON.stringify({ error: e?.message || "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
