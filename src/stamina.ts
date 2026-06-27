export type StaminaControllerOptions = {
  drainSeconds?: number;
  walkRefillSeconds?: number;
  idleRefillSeconds?: number;
  resumeThreshold?: number;
  initialAmount?: number;
};

export type StaminaUpdateInput = {
  wantsRun: boolean;
  moving: boolean;
  grounded: boolean;
  running?: boolean;
};

export type StaminaDebugState = {
  amount: number;
  normalized: number;
  running: boolean;
  canRun: boolean;
  exhausted: boolean;
  drainSeconds: number;
  walkRefillSeconds: number;
  idleRefillSeconds: number;
  resumeThreshold: number;
  message: string;
};

const defaultDrainSeconds = 5.2;
const defaultWalkRefillSeconds = 9.5;
const defaultIdleRefillSeconds = 4.2;
const defaultResumeThreshold = 0.18;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value));
}

function positiveOrDefault(value: number | undefined, fallback: number): number {
  return value && Number.isFinite(value) && value > 0 ? value : fallback;
}

export function createStaminaController(options: StaminaControllerOptions = {}): {
  update: (delta: number, input: StaminaUpdateInput) => StaminaDebugState;
  getState: () => StaminaDebugState;
  setAmount: (value: number) => StaminaDebugState;
} {
  const drainSeconds = positiveOrDefault(options.drainSeconds, defaultDrainSeconds);
  const walkRefillSeconds = positiveOrDefault(options.walkRefillSeconds, defaultWalkRefillSeconds);
  const idleRefillSeconds = positiveOrDefault(options.idleRefillSeconds, defaultIdleRefillSeconds);
  const resumeThreshold = clamp01(options.resumeThreshold ?? defaultResumeThreshold);

  let amount = clamp01(options.initialAmount ?? 1);
  let exhausted = amount <= 0;
  let running = false;

  function updateExhaustedState(): void {
    if (amount <= 0) exhausted = true;
    else if (amount >= resumeThreshold) exhausted = false;
  }

  function getMessage(): string {
    if (running) return "running";
    if (exhausted) return "winded";
    if (amount > 0.96) return "ready";
    return "recovering";
  }

  function getState(): StaminaDebugState {
    return {
      amount,
      normalized: amount,
      running,
      canRun: !exhausted && amount > 0,
      exhausted,
      drainSeconds,
      walkRefillSeconds,
      idleRefillSeconds,
      resumeThreshold,
      message: getMessage(),
    };
  }

  function update(delta: number, input: StaminaUpdateInput): StaminaDebugState {
    const step = Math.max(0, delta);
    updateExhaustedState();

    running = Boolean(input.running && input.wantsRun && input.moving && input.grounded && !exhausted && amount > 0);
    if (running) {
      amount = clamp01(amount - step / drainSeconds);
    } else if (input.grounded) {
      const refillSeconds = input.moving ? walkRefillSeconds : idleRefillSeconds;
      amount = clamp01(amount + step / refillSeconds);
    }

    updateExhaustedState();
    if (exhausted) running = false;
    return getState();
  }

  function setAmount(value: number): StaminaDebugState {
    amount = clamp01(value);
    running = false;
    exhausted = amount <= 0;
    updateExhaustedState();
    return getState();
  }

  return { update, getState, setAmount };
}
