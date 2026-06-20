export type SleepControllerOptions = {
  drainSeconds?: number;
  settleSeconds?: number;
  refillSeconds?: number;
  blackoutRecoverySeconds?: number;
  blackoutMinimumSeconds?: number;
  initialAmount?: number;
};

export type SleepUpdateInput = {
  wantsSleep: boolean;
  moving: boolean;
  grounded: boolean;
};

export type SleepDebugState = {
  amount: number;
  normalized: number;
  sleeping: boolean;
  blackout: boolean;
  canSleep: boolean;
  settling: boolean;
  stillSeconds: number;
  blackoutSeconds: number;
  drainSeconds: number;
  refillSeconds: number;
  message: string;
};

const defaultDrainSeconds = 600;
const defaultSettleSeconds = 1.25;
const defaultRefillSeconds = 8;
const defaultBlackoutRecoverySeconds = 9;
const defaultBlackoutMinimumSeconds = 3.5;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value));
}

function positiveOrDefault(value: number | undefined, fallback: number): number {
  return value && Number.isFinite(value) && value > 0 ? value : fallback;
}

export function createSleepController(options: SleepControllerOptions = {}): {
  update: (delta: number, input: SleepUpdateInput) => SleepDebugState;
  getState: () => SleepDebugState;
  setAmount: (value: number) => SleepDebugState;
} {
  const drainSeconds = positiveOrDefault(options.drainSeconds, defaultDrainSeconds);
  const settleSeconds = positiveOrDefault(options.settleSeconds, defaultSettleSeconds);
  const refillSeconds = positiveOrDefault(options.refillSeconds, defaultRefillSeconds);
  const blackoutRecoverySeconds = positiveOrDefault(
    options.blackoutRecoverySeconds,
    defaultBlackoutRecoverySeconds
  );
  const blackoutMinimumSeconds = positiveOrDefault(options.blackoutMinimumSeconds, defaultBlackoutMinimumSeconds);

  let amount = clamp01(options.initialAmount ?? 1);
  let sleeping = false;
  let blackout = amount <= 0;
  let stillSeconds = 0;
  let blackoutSeconds = blackout ? blackoutMinimumSeconds : 0;
  let lastInput: SleepUpdateInput = { wantsSleep: false, moving: false, grounded: true };

  function getMessage(): string {
    if (blackout) return "resting in the dark";
    if (sleeping) return "sleeping";
    if (!lastInput.grounded) return "land to sleep";
    if (lastInput.wantsSleep && lastInput.moving) return "stand still";
    if (lastInput.wantsSleep && amount < 1) return "settling";
    if (amount < 0.18) return "hold R soon";
    if (amount > 0.96) return "rested";
    return "hold R still";
  }

  function getState(): SleepDebugState {
    const canSleep = lastInput.grounded && !lastInput.moving && !blackout;
    return {
      amount,
      normalized: amount,
      sleeping,
      blackout,
      canSleep,
      settling: Boolean(lastInput.wantsSleep && canSleep && !sleeping && amount < 1),
      stillSeconds,
      blackoutSeconds,
      drainSeconds,
      refillSeconds,
      message: getMessage(),
    };
  }

  function update(delta: number, input: SleepUpdateInput): SleepDebugState {
    const step = Math.max(0, delta);
    lastInput = input;

    if (blackout) {
      blackoutSeconds += step;
      sleeping = false;
      stillSeconds = 0;
      amount = clamp01(amount + step / blackoutRecoverySeconds);

      if (amount >= 1 && blackoutSeconds >= blackoutMinimumSeconds) {
        amount = 1;
        blackout = false;
        blackoutSeconds = 0;
      }

      return getState();
    }

    const restingAtFull = input.wantsSleep && input.grounded && !input.moving && amount >= 1;
    const canSettle = input.wantsSleep && input.grounded && !input.moving && amount < 1;
    if (canSettle) {
      stillSeconds += step;
      sleeping = stillSeconds >= settleSeconds;
      if (sleeping) amount = clamp01(amount + step / refillSeconds);
    } else if (restingAtFull) {
      amount = 1;
      sleeping = false;
      stillSeconds = 0;
    } else {
      sleeping = false;
      stillSeconds = 0;
      amount = clamp01(amount - step / drainSeconds);
    }

    if (amount <= 0) {
      amount = 0;
      blackout = true;
      sleeping = false;
      stillSeconds = 0;
      blackoutSeconds = 0;
    }

    return getState();
  }

  function setAmount(value: number): SleepDebugState {
    amount = clamp01(value);
    sleeping = false;
    blackout = amount <= 0;
    stillSeconds = 0;
    blackoutSeconds = 0;
    return getState();
  }

  return { update, getState, setAmount };
}
