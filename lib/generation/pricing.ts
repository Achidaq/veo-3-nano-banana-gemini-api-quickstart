export const VEO_MODELS = {
  "veo-3.1-lite-generate-preview": "lite",
  "veo-3.1-fast-generate-preview": "fast",
  "veo-3.1-generate-preview": "standard",
} as const;

export type VeoModel = keyof typeof VEO_MODELS;
export type VeoResolution = "720p" | "1080p" | "4k";
export type VeoDuration = 4 | 6 | 8;

const CREDITS_PER_SECOND: Record<
  (typeof VEO_MODELS)[VeoModel],
  Partial<Record<VeoResolution, number>>
> = {
  lite: { "720p": 1, "1080p": 2 },
  fast: { "720p": 2, "1080p": 3, "4k": 6 },
  standard: { "720p": 8, "1080p": 8, "4k": 12 },
};

const PROVIDER_USD_PER_SECOND: Record<
  (typeof VEO_MODELS)[VeoModel],
  Partial<Record<VeoResolution, number>>
> = {
  lite: { "720p": 0.05, "1080p": 0.08 },
  fast: { "720p": 0.1, "1080p": 0.12, "4k": 0.3 },
  standard: { "720p": 0.4, "1080p": 0.4, "4k": 0.6 },
};

export function quoteVeoCredits(input: {
  model: string;
  resolution: string;
  durationSeconds: number;
}) {
  if (!(input.model in VEO_MODELS)) {
    throw new Error("Unsupported Veo model");
  }

  if (!["720p", "1080p", "4k"].includes(input.resolution)) {
    throw new Error("Unsupported Veo resolution");
  }

  if (![4, 6, 8].includes(input.durationSeconds)) {
    throw new Error("Unsupported Veo duration");
  }

  const model = input.model as VeoModel;
  const resolution = input.resolution as VeoResolution;
  const durationSeconds = input.durationSeconds as VeoDuration;
  const tier = VEO_MODELS[model];
  const creditRate = CREDITS_PER_SECOND[tier][resolution];
  const providerRate = PROVIDER_USD_PER_SECOND[tier][resolution];

  if (!creditRate || !providerRate) {
    throw new Error("Resolution is not supported by this Veo model");
  }

  if ((resolution === "1080p" || resolution === "4k") && durationSeconds !== 8) {
    throw new Error("1080p and 4K Veo generations must be 8 seconds");
  }

  return {
    model,
    tier,
    resolution,
    durationSeconds,
    credits: creditRate * durationSeconds,
    estimatedProviderCostUsd: providerRate * durationSeconds,
  };
}
