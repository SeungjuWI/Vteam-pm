"use client";

import { createContext, useContext } from "react";
import ko, { type TranslationKey } from "./ko";
import en from "./en";

const dictionaries: Record<string, Record<TranslationKey, string>> = { ko, en };

export type TFunction = (key: TranslationKey) => string;

function createT(locale: string): TFunction {
  const dict = dictionaries[locale] || dictionaries.ko;
  return (key: TranslationKey) => dict[key] ?? dictionaries.ko[key] ?? key;
}

// Client-side context
const I18nContext = createContext<TFunction>(createT("ko"));

export const I18nProvider = I18nContext.Provider;

export function useT(): TFunction {
  return useContext(I18nContext);
}

export function makeT(locale: string): TFunction {
  return createT(locale);
}

// Re-export for convenience
export type { TranslationKey };
