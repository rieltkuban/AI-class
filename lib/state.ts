import type { Contour, CycleDays, EstimateResult } from './pricing';

/** Роль посетителя в решении. В расчёте не участвует, уходит в заявку. */
export type Role = 'owner' | 'ceo' | 'exec' | 'other';

/** Состояния страницы (ТЗ, 4.1). URL не меняется, всё живёт в клиентском стейте. */
export type Screen =
  | 'terminal'
  | 'calibration'
  | 'figure'
  | 'run'
  | 'construction'
  | 'admission'
  | 'return'
  | 'bystander';

export interface Answers {
  contour: Contour | null;
  cycleDays: CycleDays | null;
  role: Role | null;
  revenue: number | null;
}

export interface AppState {
  screen: Screen;
  /** Шаг калибровки: 0 — контур, 1 — цикл, 2 — роль, 3 — выручка. */
  step: number;
  answers: Answers;
  estimate: EstimateResult | null;
  estimateError: boolean;
  pending: boolean;
  /** Посетитель уже был здесь — читается из localStorage. */
  returning: boolean;
}

export const CALIBRATION_STEPS = 4;

export const initialState: AppState = {
  screen: 'terminal',
  step: 0,
  answers: { contour: null, cycleDays: null, role: null, revenue: null },
  estimate: null,
  estimateError: false,
  pending: false,
  returning: false,
};

export type Action =
  | { type: 'start' }
  | { type: 'skip' }
  | { type: 'answer_contour'; value: Contour }
  | { type: 'answer_cycle'; value: CycleDays }
  | { type: 'answer_role'; value: Role }
  | { type: 'answer_revenue'; value: number }
  | { type: 'back' }
  | { type: 'estimate_pending' }
  | { type: 'estimate_done'; value: EstimateResult }
  | { type: 'estimate_failed' }
  | { type: 'restart_calibration' }
  | { type: 'goto'; screen: Screen }
  | { type: 'mark_returning' };

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'start':
      return { ...state, screen: 'calibration', step: 0 };

    case 'skip':
      return { ...state, screen: 'admission' };

    case 'answer_contour':
      return {
        ...state,
        answers: { ...state.answers, contour: action.value },
        step: 1,
      };

    case 'answer_cycle':
      return {
        ...state,
        answers: { ...state.answers, cycleDays: action.value },
        step: 2,
      };

    case 'answer_role':
      // Кто не принимает решение сам — уходит на короткую честную ветку,
      // без прогона и без полной воронки.
      if (action.value === 'other') {
        return {
          ...state,
          answers: { ...state.answers, role: action.value },
          screen: 'bystander',
        };
      }
      return {
        ...state,
        answers: { ...state.answers, role: action.value },
        step: 3,
      };

    case 'answer_revenue':
      return { ...state, answers: { ...state.answers, revenue: action.value } };

    case 'back':
      if (state.screen !== 'calibration' || state.step === 0) {
        return { ...state, screen: 'terminal', step: 0 };
      }
      return { ...state, step: state.step - 1 };

    case 'estimate_pending':
      return { ...state, pending: true, estimateError: false };

    case 'estimate_done':
      return {
        ...state,
        pending: false,
        estimateError: false,
        estimate: action.value,
        screen: 'figure',
      };

    case 'estimate_failed':
      return { ...state, pending: false, estimateError: true };

    case 'restart_calibration':
      return {
        ...state,
        screen: 'calibration',
        step: 0,
        estimate: null,
        estimateError: false,
        answers: { contour: null, cycleDays: null, role: null, revenue: null },
      };

    case 'goto':
      return { ...state, screen: action.screen };

    case 'mark_returning':
      return { ...state, returning: true };

    default:
      return state;
  }
}
