"use client";

import { useLanguage } from "./LanguageProvider";
import type { Locale } from "./config";

const numberLocaleByLanguage: Partial<Record<Locale, string>> = {
  en: "en-US",
  de: "de-DE",
  it: "it-IT",
  fr: "fr-FR",
  ar: "ar-AE",
};

export function useFormatter() {
  const { locale } = useLanguage();

  const intlLocale = numberLocaleByLanguage[locale] ?? "en-US";

  const formatNumber = (
    value: number,
    options?: Intl.NumberFormatOptions
  ): string => {
    return new Intl.NumberFormat(intlLocale, options).format(value);
  };

  // plain integer, no decimal places
  const formatInteger = (value: number): string => {
    return formatNumber(value, {
      maximumFractionDigits: 0,
    });
  };

  // general decimal, up to two fraction digits
  const formatDecimal = (value: number): string => {
    return formatNumber(value, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  };

  // percent expects value between 0 and 1
  // example: 0.42 becomes 42%
  const formatPercent = (value: number): string => {
    return formatNumber(value, {
      style: "percent",
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    });
  };

  return {
    formatNumber,
    formatInteger,
    formatDecimal,
    formatPercent,
  };
}
