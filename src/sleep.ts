export type SleepControllerOptions = {
  drainSeconds?: number;
  settleSeconds?: number;
  refillSeconds?: number;
  blackoutRecoverySeconds?: number;
  blackoutMinimumSeconds?: number;
  eyelidCloseSeconds?: number;
  eyelidOpenSeconds?: number;
  initialAmount?: number;
};

export type SleepUpdateInput = {
  wantsSleep: boolean;
  moving: boolean;
  grounded: boolean;
  movementAmount?: number;
  crouching?: boolean;
  running?: boolean;
  airborne?: boolean;
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
  eyelidAmount: number;
  eyelidPhase: "open" | "closing" | "closed" | "opening";
  drainSeconds: number;
  drainMultiplier: number;
  refillSeconds: number;
  message: string;
};

const defaultDrainSeconds = 600;
const defaultSettleSeconds = 1.25;
const defaultRefillSeconds = 8;
const defaultBlackoutRecoverySeconds = 9;
const defaultBlackoutMinimumSeconds = 3.5;
const defaultEyelidCloseSeconds = 1.05;
const defaultEyelidOpenSeconds = 1.05;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value));
}

function positiveOrDefault(value: number | undefined, fallback: number): number {
  return value && Number.isFinite(value) && value > 0 ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function normalizeSleepInput(input: SleepUpdateInput): SleepUpdateInput {
  const movementAmount = clamp(input.movementAmount ?? (input.moving ? 1 : 0), 0, 1);
  return {
    ...input,
    moving: input.moving || movementAmount > 0.05,
    movementAmount,
    crouching: Boolean(input.crouching),
    running: Boolean(input.running),
    airborne: Boolean(input.airborne || !input.grounded),
  };
}

function getDrainMultiplier(input: SleepUpdateInput): number {
  const movementAmount = clamp(input.movementAmount ?? (input.moving ? 1 : 0), 0, 1);
  const airborne = Boolean(input.airborne || !input.grounded);
  const moving = input.moving || movementAmount > 0.05;
  let multiplier = moving ? 1 + movementAmount * 0.25 : 0.6;

  if (moving && input.crouching) {
    multiplier = 0.8;
  }
  if (moving && input.running) {
    multiplier = Math.max(multiplier, 1.75);
  }
  if (airborne) {
    multiplier = Math.max(multiplier, 2.1);
  }

  return clamp(multiplier, 0.5, 2.5);
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
  const eyelidCloseSeconds = positiveOrDefault(options.eyelidCloseSeconds, defaultEyelidCloseSeconds);
  const eyelidOpenSeconds = positiveOrDefault(options.eyelidOpenSeconds, defaultEyelidOpenSeconds);

  let amount = clamp01(options.initialAmount ?? 1);
  let sleeping = false;
  let blackout = amount <= 0;
  let stillSeconds = 0;
  let blackoutSeconds = blackout ? blackoutMinimumSeconds : 0;
  let eyelidAmount = 0;
  let lastInput: SleepUpdateInput = { wantsSleep: false, moving: false, grounded: true };
  let lastDrainMultiplier = getDrainMultiplier(lastInput);

  function moveEyelids(delta: number, closed: boolean): void {
    const duration = closed ? eyelidCloseSeconds : eyelidOpenSeconds;
    const step = duration > 0 ? delta / duration : 1;
    const target = closed ? 1 : 0;
    if (eyelidAmount < target) eyelidAmount = Math.min(target, eyelidAmount + step);
    else if (eyelidAmount > target) eyelidAmount = Math.max(target, eyelidAmount - step);
  }

  function getEyelidPhase(): SleepDebugState["eyelidPhase"] {
    if (eyelidAmount <= 0) return "open";
    if (eyelidAmount >= 1) return "closed";
    return sleeping ? "closing" : "opening";
  }

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
      eyelidAmount,
      eyelidPhase: getEyelidPhase(),
      drainSeconds,
      drainMultiplier: lastDrainMultiplier,
      refillSeconds,
      message: getMessage(),
    };
  }

  function update(delta: number, input: SleepUpdateInput): SleepDebugState {
    const step = Math.max(0, delta);
    lastInput = normalizeSleepInput(input);
    lastDrainMultiplier = getDrainMultiplier(lastInput);

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

      moveEyelids(step, false);
      return getState();
    }

    const restingAtFull = lastInput.wantsSleep && lastInput.grounded && !lastInput.moving && amount >= 1;
    const canSettle = lastInput.wantsSleep && lastInput.grounded && !lastInput.moving && amount < 1;
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
      amount = clamp01(amount - (step / drainSeconds) * lastDrainMultiplier);
    }

    if (amount <= 0) {
      amount = 0;
      blackout = true;
      sleeping = false;
      stillSeconds = 0;
      blackoutSeconds = 0;
    }

    moveEyelids(step, sleeping && !blackout);
    return getState();
  }

  function setAmount(value: number): SleepDebugState {
    amount = clamp01(value);
    sleeping = false;
    blackout = amount <= 0;
    stillSeconds = 0;
    blackoutSeconds = 0;
    eyelidAmount = 0;
    return getState();
  }

  return { update, getState, setAmount };
}
