import { cookies } from "next/headers";
import ko, { type TranslationKey } from "./ko";
import en from "./en";

const dictionaries: Record<string, Record<TranslationKey, string>> = { ko, en };

export type TFunction = (key: TranslationKey) => string;

export async function getLocale(): Promise<string> {
  const cookieStore = await cookies();
  return cookieStore.get("vteam-ui-lang")?.value || "ko";
}

export async function getT(): Promise<TFunction> {
  const locale = await getLocale();
  const dict = dictionaries[locale] || dictionaries.ko;
  return (key: TranslationKey) => dict[key] ?? dictionaries.ko[key] ?? key;
}

export function makeTFromLocale(locale: string): TFunction {
  const dict = dictionaries[locale] || dictionaries.ko;
  return (key: TranslationKey) => dict[key] ?? dictionaries.ko[key] ?? key;
}
