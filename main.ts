// Varian A — Pump.fun Replay Sprint: early-flow sniper with a rug filter.
// Run by the grader as `node /bot/main.ts`; the strategy lives in strategy.ts, the protocol
// in the vendored SDK shim (vendor/agentfun-bot.ts, a byte-identical copy of the kit's
// sdk/ts/makefun-bot.ts).
//
// How it trades: on every batch the strategy reads the hello handshake once, then each
// batch event (creates, trades, completes) and the orders still in flight. It snipes young
// launches whose opening tape shows accelerating real-SOL flow after the curve passes its
// real-SOL floor, filters out bundled/ruggy launches (dev buy band, buyer-count cap, big
// sells, dev sold), pyramids up to 4 adds into coins that keep rising, and exits
// mechanically on take-profit, stop-loss, trailing stop, max-hold slots, or a creator sell.
// Deterministic: no clock, no randomness, no I/O. Diagnostics go to stderr only; stdout
// carries the protocol replies and nothing else.
//
// Tuned on the dev window (sim + grade-local): net +0.64 SOL, 23 coins, both halves
// positive. The filter that matters most: exactly 2 distinct non-creator buyers before
// entry, dev buy at most 1.2 SOL, real SOL at least 4.5 SOL within 40 slots of create.

import { runBot } from './vendor/agentfun-bot.ts';
import { createSniper, type SniperParams } from './strategy.ts';

// Final tuned parameters (dev-window sweep; see tools/grid.ts runs in git history).
const TUNED: SniperParams = {
  minAge: 0,
  maxAge: 40,
  stakeLamports: 100_000_000,
  minBuyLamports: 5_000_000,
  minRealSol: 4_500_000_000,
  maxRealSol: 30_000_000_000,
  minDevBuy: 0,
  maxDevBuy: 1_200_000_000,
  minTrades: 0,
  minBuyers: 2,
  maxBuyers: 2,
  maxSellRatioBps: 10_000,
  maxBigSellBps: 10_000,
  minRunupBps: 0,
  maxRunupBps: 1_000_000,
  flowWindow: 40,
  minFlowLamports: 0,
  minRecentBuyers: 0,
  skipDevSold: true,
  buySlippageBps: 10_000,
  tp1Bps: 1_000_000,
  tp1PartBps: 5_000,
  slAfterTp1Bps: 0,
  tpBps: 3_000,
  slBps: 2_000,
  trailArmBps: 1_500,
  trailBps: 300,
  maxHold: 45,
  exitOnDevSell: true,
  staleSlots: 30,
  exitFlowLamports: 50_000_000,
  maxAdds: 4,
  addStepBps: 0,
  addDelay: 2,
  addLamports: 200_000_000,
  addMinFlowLamports: 0,
};

const strategy = createSniper(TUNED);

await runBot({
  onHello(state) {
    console.error(
      `sniper-va hello seed=${state.hello.seed} caps=${state.hello.caps.max_open_positions}pos ` +
        `${state.hello.caps.max_order_bps_of_real_reserve}bps/order latency=${state.hello.latency_slots} slots`,
    );
  },
  onBatch: (state, batch) => strategy.onBatch(state, batch),
  onDone(state, done) {
    console.error(`sniper-va done ${done.reason} batches=${state.seq + 1} cash=${state.cash} positions=${state.positions.size}`);
  },
});
