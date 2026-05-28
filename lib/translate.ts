import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function translateText(
  text: string,
  fromLang: string,
  toLang: string
): Promise<string> {
  if (fromLang === toLang) return text;

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content: `You are a translator. Translate the user's message from ${fromLang} to ${toLang}. Only output the translated text, nothing else. Keep the tone and style natural, as if a native speaker wrote it. Preserve emojis and formatting.`,
      },
      { role: "user", content: text },
    ],
  });

  return res.choices[0]?.message?.content?.trim() ?? text;
}
