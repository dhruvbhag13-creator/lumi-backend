// api/analyze-recap.ts (or src/app/api/analyze-recap/route.ts if using app router)
import OpenAI from "openai";

export const config = {
  runtime: "edge",
};

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req: Request) {
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

Your job is to analyze a small recap: a user caption describing their week, event, or trip, and a set of photos.

You must respond with a SINGLE json object with EXACTLY this shape:

{
  "vibeKey": "hype" | "cozy" | "travel" | "friends" | "chill" | "nostalgic" | "wholesome" | "default",
  "vibeLabel": "string",
  "emotion": "nostalgic" | "wholesome" | "joyful" | "bittersweet" | "adventurous" | "calm" | "energizing" | "romantic" | "default",
  "title": "string",
  "description": "string",
  "orderedIndices": [0, 1, 2],
  "highlightIndices": [0, 2]
}

--- RULES ---

- There are N slides, in the same order they appear in the user message.
- Treat the first image as slide 0, the next as slide 1, and so on.

1) "vibeKey"
- Simple high-level category for styling (color, transitions, energy).
- Use the one that best fits the photos or caption.
- If unclear, choose "default".

2) "emotion"
- This is the emotional fingerprint of the recap.
- It should reflect the FEELING of the photos + caption (nostalgic, wholesome, joyful, adventurous, etc.).
- Use "default" only if no emotional signal is available.
- This is important for future emotion-based discovery.

3) "vibeLabel"
- Short, aesthetic phrase based on vibeKey and emotion.
- 2–4 words max.
- Examples: "nostalgic nights", "cozy winter vibe", "wholesome weekend", "adventurous escape".

4) "title"
- 2–5 words.
- Aesthetic recap title (e.g., "Chicago Weekend", "Barcelona Nights", "Fall Memories").

5) "description"
- ONE sentence (~140 chars max).
- Summarizes the emotional arc or vibe of the recap.
- No hashtags, no emojis.

6) "orderedIndices"
- A permutation of [0, 1, ..., N-1] for the slides.
- Reorder them into the best narrative / story sequence.
- If unsure how to reorder, you may keep them in original order.

7) "highlightIndices"
- 2–5 integers.
- Each integer must be a valid index in [0, N-1].
- Choose the most emotional, aesthetic, or meaningful slides.

--- IMPORTANT ---

- Use BOTH caption + photos to infer vibe and emotion.
- Avoid explicit/NSFW content.
- Output VALID json ONLY — no explanation, no Markdown, no surrounding text.
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Caption: ${caption || ""}`,
            },
            ...slides.map((s: { dataUrl: string }) => ({
              type: "image_url",
              image_url: { url: s.dataUrl },
            })),
          ],
        },
      ],
    });

    const jsonText = completion.choices[0].message.content ?? "{}";

    return new Response(jsonText, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("analyze-recap error:", e);
    return new Response(
      JSON.stringify({ error: e?.message || "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
