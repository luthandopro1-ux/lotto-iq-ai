import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

export type PricingContext = {
  countryCode: string;
  countrySource: "edge" | "fallback";
  baseCurrency: "ZAR";
  localizedConversionAvailable: false;
};

export const getPricingContext = createServerFn({ method: "GET" }).handler(
  async (): Promise<PricingContext> => {
    const request = getRequest();
    const edgeCountry =
      request?.headers.get("cf-ipcountry") ?? request?.headers.get("x-country-code");
    const countryCode =
      edgeCountry && /^[A-Z]{2}$/i.test(edgeCountry) ? edgeCountry.toUpperCase() : "ZA";
    return {
      countryCode,
      countrySource: edgeCountry ? "edge" : "fallback",
      baseCurrency: "ZAR",
      localizedConversionAvailable: false,
    };
  },
);
