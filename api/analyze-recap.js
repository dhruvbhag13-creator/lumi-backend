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
... same system prompt as before ...
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
            // ✅ use data URLs coming from the app
            ...slides.map((s) => ({
              type: "image_url",
              image_url: { url: s.dataUrl },
            })),
          ],
        },
      ],
    });

    const jsonText = completion.choices[0].message.content;

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
