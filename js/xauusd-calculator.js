/**
 * xauusd-calculator — zero-dependency XAUUSD (gold) position maths.
 * Works in Node (>=18) and modern browsers as an ES module.
 * @module xauusd-calculator
 */

/** Troy ounces in one standard lot (most CFD brokers; check yours). */
export const OZ_PER_LOT = 100;
/** Default pip size in USD price units ($0.10). */
export const DEFAULT_PIP_SIZE = 0.1;

function num(name, v, { min = -Infinity, positive = false, nonNegative = false } = {}) {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new TypeError(`${name} must be a finite number`);
  if (positive && v <= 0) throw new RangeError(`${name} must be > 0`);
  if (nonNegative && v < 0) throw new RangeError(`${name} must be >= 0`);
  if (v < min) throw new RangeError(`${name} must be >= ${min}`);
  return v;
}
function side(s) {
  if (s !== 'buy' && s !== 'sell') throw new RangeError("side must be 'buy' or 'sell'");
  return s;
}

/**
 * USD value of one pip for a given lot size.
 * @param {number} lots Position size in lots.
 * @param {object} [opts]
 * @param {number} [opts.pipSize=0.1] Price move that counts as one pip.
 * @param {number} [opts.ozPerLot=100] Contract size in ounces.
 * @returns {number} USD per pip.
 */
export function pipValue(lots, { pipSize = DEFAULT_PIP_SIZE, ozPerLot = OZ_PER_LOT } = {}) {
  num('lots', lots, { nonNegative: true });
  num('pipSize', pipSize, { positive: true });
  num('ozPerLot', ozPerLot, { positive: true });
  return lots * ozPerLot * pipSize;
}

/**
 * Convert a price distance (USD) to pips.
 * @param {number} distance Absolute price distance, e.g. 5.00.
 * @param {number} [pipSize=0.1]
 * @returns {number}
 */
export function priceToPips(distance, pipSize = DEFAULT_PIP_SIZE) {
  num('distance', distance, { nonNegative: true });
  num('pipSize', pipSize, { positive: true });
  return distance / pipSize;
}

/**
 * Round lots down to the broker's volume step.
 * @param {number} lots
 * @param {number} [step=0.01]
 * @returns {number}
 */
export function roundLotsDown(lots, step = 0.01) {
  num('lots', lots, { nonNegative: true });
  num('step', step, { positive: true });
  const n = Math.floor(lots / step + 1e-9);
  const decimals = (String(step).split('.')[1] || '').length;
  return Number((n * step).toFixed(decimals));
}

/**
 * Lot size so that hitting the stop loses `riskPct` % of the balance.
 * @param {number} balance Account balance in USD.
 * @param {number} riskPct Risk per trade in percent (e.g. 1 for 1%).
 * @param {number} stopDistance Stop distance in USD price units (e.g. 5.00).
 * @param {object} [opts]
 * @param {number} [opts.ozPerLot=100]
 * @param {number} [opts.lotStep] If given, result is rounded down to this step.
 * @returns {{riskAmount:number, lots:number, ounces:number}}
 */
export function lotSize(balance, riskPct, stopDistance, { ozPerLot = OZ_PER_LOT, lotStep } = {}) {
  num('balance', balance, { positive: true });
  num('riskPct', riskPct, { positive: true });
  if (riskPct > 100) throw new RangeError('riskPct must be <= 100');
  num('stopDistance', stopDistance, { positive: true });
  num('ozPerLot', ozPerLot, { positive: true });
  const riskAmount = (balance * riskPct) / 100;
  let lots = riskAmount / (stopDistance * ozPerLot);
  if (lotStep !== undefined) lots = roundLotsDown(lots, lotStep);
  return { riskAmount, lots, ounces: lots * ozPerLot };
}

/**
 * Position size from entry and stop prices.
 * @param {object} p
 * @param {number} p.balance
 * @param {number} p.riskPct
 * @param {number} p.entry
 * @param {number} p.stop
 * @param {number} [p.ozPerLot=100]
 * @param {number} [p.pipSize=0.1]
 * @param {number} [p.lotStep]
 * @returns {{riskAmount:number, stopDistance:number, stopPips:number, lots:number, ounces:number, notional:number}}
 */
export function positionSize({ balance, riskPct, entry, stop, ozPerLot = OZ_PER_LOT, pipSize = DEFAULT_PIP_SIZE, lotStep }) {
  num('entry', entry, { positive: true });
  num('stop', stop, { positive: true });
  if (entry === stop) throw new RangeError('entry and stop must differ');
  const stopDistance = Math.abs(entry - stop);
  const r = lotSize(balance, riskPct, stopDistance, { ozPerLot, lotStep });
  return { ...r, stopDistance, stopPips: priceToPips(stopDistance, pipSize), notional: r.ounces * entry };
}

/**
 * Profit or loss in USD (positive = profit).
 * @param {number} entry
 * @param {number} exit
 * @param {number} lots
 * @param {'buy'|'sell'} [tradeSide='buy']
 * @param {number} [ozPerLot=100]
 * @returns {number}
 */
export function profitLoss(entry, exit, lots, tradeSide = 'buy', ozPerLot = OZ_PER_LOT) {
  num('entry', entry, { positive: true });
  num('exit', exit, { positive: true });
  num('lots', lots, { nonNegative: true });
  side(tradeSide);
  const move = tradeSide === 'buy' ? exit - entry : entry - exit;
  return move * lots * ozPerLot;
}

/**
 * Risk:reward ratio for a planned trade. Validates stop/target are on the correct sides.
 * @param {number} entry
 * @param {number} stop
 * @param {number} target
 * @param {'buy'|'sell'} [tradeSide='buy']
 * @returns {{risk:number, reward:number, ratio:number}} ratio = reward / risk.
 */
export function riskReward(entry, stop, target, tradeSide = 'buy') {
  num('entry', entry, { positive: true });
  num('stop', stop, { positive: true });
  num('target', target, { positive: true });
  side(tradeSide);
  const risk = tradeSide === 'buy' ? entry - stop : stop - entry;
  const reward = tradeSide === 'buy' ? target - entry : entry - target;
  if (risk <= 0) throw new RangeError(`stop must be ${tradeSide === 'buy' ? 'below' : 'above'} entry`);
  if (reward <= 0) throw new RangeError(`target must be ${tradeSide === 'buy' ? 'above' : 'below'} entry`);
  return { risk, reward, ratio: reward / risk };
}

/**
 * Required margin in USD.
 * @param {number} lots
 * @param {number} price Current XAUUSD price.
 * @param {number} leverage e.g. 100 for 1:100.
 * @param {number} [ozPerLot=100]
 * @returns {number}
 */
export function margin(lots, price, leverage, ozPerLot = OZ_PER_LOT) {
  num('lots', lots, { nonNegative: true });
  num('price', price, { positive: true });
  num('leverage', leverage, { positive: true });
  return (lots * ozPerLot * price) / leverage;
}
