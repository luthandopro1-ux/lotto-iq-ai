import { z } from "zod";
import { SESSIONS } from "@/lib/uk49";

/** Version shared by the current Worker contract and the phase-gated analytics service. */
export const ANALYTICS_CONTRACT_VERSION = "analytics.v1" as const;
export const ANALYTICS_MODEL_VERSION = "typescript-live.v1" as const;
export const ANALYTICS_FEATURE_VERSION = "uk49-features.v1" as const;
export const ANALYTICS_STRATEGY_SET_VERSION = "strategy-set.v1" as const;

export const AnalyticsSessionSchema = z.enum(SESSIONS);
export type AnalyticsSession = z.infer<typeof AnalyticsSessionSchema>;

export const AnalysisRunRequestSchema = z.object({
  contractVersion: z.literal(ANALYTICS_CONTRACT_VERSION),
  targetDate: z.string().date(),
  targetSession: AnalyticsSessionSchema,
  strategyIds: z.array(z.string().uuid()).max(500),
  sourceDrawWatermark: z.string().date().nullable(),
  parametersHash: z.string().regex(/^[a-f0-9]{64}$/),
});
export type AnalysisRunRequest = z.infer<typeof AnalysisRunRequestSchema>;

export const AnalysisRunResponseSchema = z.object({
  contractVersion: z.literal(ANALYTICS_CONTRACT_VERSION),
  executionStatus: z.enum(["queued", "running", "completed", "failed"]),
  targetDate: z.string().date(),
  targetSession: AnalyticsSessionSchema,
  modelVersion: z.string().min(1),
  featureVersion: z.string().min(1),
  strategySetVersion: z.string().min(1),
  parametersHash: z.string().regex(/^[a-f0-9]{64}$/),
  sourceDrawWatermark: z.string().date().nullable(),
  result: z.record(z.string(), z.unknown()).nullable(),
});
export type AnalysisRunResponse = z.infer<typeof AnalysisRunResponseSchema>;

export const BacktestRequestSchema = z.object({
  contractVersion: z.literal(ANALYTICS_CONTRACT_VERSION),
  dateFrom: z.string().date(),
  dateTo: z.string().date(),
  strategyIds: z.array(z.string().uuid()).max(500),
  simulations: z.number().int().min(0).max(10_000).default(150),
  parametersHash: z.string().regex(/^[a-f0-9]{64}$/),
});
export type BacktestRequest = z.infer<typeof BacktestRequestSchema>;

export const AnalyticsJobSchema = z.object({
  id: z.string().uuid(),
  contractVersion: z.literal(ANALYTICS_CONTRACT_VERSION),
  kind: z.enum(["analysis", "backtest", "feature-generation", "model-evaluation"]),
  status: z.enum(["queued", "running", "completed", "failed", "cancelled"]),
  requestId: z.string().min(1),
  modelVersion: z.string().min(1),
  parametersHash: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  finishedAt: z.string().datetime().nullable(),
});
export type AnalyticsJob = z.infer<typeof AnalyticsJobSchema>;

export function validateAnalysisRunRequest(input: unknown): AnalysisRunRequest {
  return AnalysisRunRequestSchema.parse(input);
}

export function validateBacktestRequest(input: unknown): BacktestRequest {
  return BacktestRequestSchema.parse(input);
}
