/**
 * Russia lottery module — types.
 *
 * Fully independent of src/lib/uk49.ts and friends. Nothing here is
 * imported by the UK49 engine, and this module never imports from it.
 */

export interface LotteryGame {
  id: string;
  code: string;
  game_name: string;
  country: string;
  number_range_min: number;
  number_range_max: number;
  numbers_drawn: number;
  bankers_count: number;
  active: boolean;
}

export interface LotteryDraw {
  id: string;
  game_id: string;
  draw_date: string;
  draw_number: number;
  winning_numbers: number[];
  source: string | null;
  created_at: string;
}

export interface ComponentScore {
  /** 0..1, already normalised so components can be summed with weights. */
  value: number;
  /** Human-readable magnitude for explanations, e.g. "38% of last 30 draws". */
  detail: string;
}

export interface NumberScore {
  n: number;
  composite: number;
  components: {
    frequency: ComponentScore;
    momentum: ComponentScore;
    gap: ComponentScore;
    zScore: ComponentScore;
    bayesian: ComponentScore;
    pair: ComponentScore;
    triplet: ComponentScore;
    delayedHit: ComponentScore;
  };
}

export interface EnsembleWeights {
  frequency: number;
  momentum: number;
  gap: number;
  zScore: number;
  bayesian: number;
  pair: number;
  triplet: number;
  delayedHit: number;
}

export const DEFAULT_WEIGHTS: EnsembleWeights = {
  frequency: 0.18,
  momentum: 0.14,
  gap: 0.12,
  zScore: 0.14,
  bayesian: 0.14,
  pair: 0.12,
  triplet: 0.08,
  delayedHit: 0.08,
};

export interface RussiaPrediction {
  gameId: string;
  targetDrawNumber: number;
  bankers: number[];
  predictedNumbers: number[];
  scores: NumberScore[];
  explanation: Record<number, string[]>;
}

export interface PredictionGrade {
  actualNumbers: number[];
  totalHits: number;
  bankerHits: number;
  matchedNumbers: number[];
}
