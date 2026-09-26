// Pure game logic: no React, no storage. Money values are integer cents and
// chip counts are integers, so sums never suffer from floating point rounding.

export type Player = {
  id: string;
  name: string;
  /** How often the player bought in (initial buy-in counts as 1). */
  buyIns: number;
  /**
   * Final stack entered at the end of the game: cents in money mode,
   * chips when the game has `chipsPerBuyIn` set.
   */
  final: number | null;
  /** True once the player left early; `final` then holds the stack they left with. */
  out?: boolean;
};

export type Phase = 'setup' | 'playing' | 'ending' | 'result';

export type Game = {
  phase: Phase;
  buyInCents: number;
  currency: string;
  /** Chips handed out per buy-in, or null when final stacks are entered as money. */
  chipsPerBuyIn: number | null;
  players: Player[];
  startedAt: number | null;
};

export type Transfer = { from: string; to: string; cents: number };

export function newGame(): Game {
  return {
    phase: 'setup',
    buyInCents: 1000,
    currency: '€',
    chipsPerBuyIn: null,
    players: [],
    startedAt: null,
  };
}

let idCounter = 0;
export function newId(): string {
  idCounter += 1;
  return `${Date.now().toString(36)}-${idCounter}`;
}

/** Parses user input like "12", "12,5", "12.50", "1.234,50" into cents. */
export function parseMoney(input: string): number | null {
  let s = input.trim().replace(/\s|€|\$/g, '');
  if (s === '') return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    // Whichever separator comes last is the decimal separator.
    const thousands = lastComma > lastDot ? '.' : ',';
    s = s.split(thousands).join('');
  }
  s = s.replace(',', '.');
  if (!/^-?\d*\.?\d{0,2}$/.test(s) || s === '.' || s === '-' || s === '') return null;
  const value = Math.round(parseFloat(s) * 100);
  return Number.isFinite(value) ? value : null;
}

/** Parses a whole chip count like "1500" or "1.500". */
export function parseChips(input: string): number | null {
  const s = input.trim().replace(/[\s.]/g, '');
  if (!/^\d+$/.test(s)) return null;
  const value = parseInt(s, 10);
  return Number.isSafeInteger(value) ? value : null;
}

function groupThousands(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function formatMoney(cents: number, currency: string, withSign = false): string {
  const sign = cents < 0 ? '-' : withSign && cents > 0 ? '+' : '';
  const abs = Math.abs(cents);
  const euros = groupThousands(Math.floor(abs / 100));
  const rest = abs % 100;
  const amount = rest === 0 ? euros : `${euros},${rest.toString().padStart(2, '0')}`;
  return `${sign}${amount} ${currency}`.trim();
}

export function formatChips(chips: number, withSign = false): string {
  const sign = chips < 0 ? '-' : withSign && chips > 0 ? '+' : '';
  return `${sign}${groupThousands(Math.abs(chips))} Chips`;
}

/** Stack size per buy-in in the unit final stacks are entered in. */
export function stackPerBuyIn(game: Game): number {
  return game.chipsPerBuyIn ?? game.buyInCents;
}

export function parseStack(input: string, game: Game): number | null {
  return game.chipsPerBuyIn === null ? parseMoney(input) : parseChips(input);
}

export function formatStack(value: number, game: Game, withSign = false): string {
  return game.chipsPerBuyIn === null
    ? formatMoney(value, game.currency, withSign)
    : formatChips(value, withSign);
}

export function investedCents(player: Player, buyInCents: number): number {
  return player.buyIns * buyInCents;
}

export function totalPotCents(game: Game): number {
  return game.players.reduce((sum, p) => sum + investedCents(p, game.buyInCents), 0);
}

/** Everything that was bought in, in stack units (cents or chips). */
export function totalPotStack(game: Game): number {
  return game.players.reduce((sum, p) => sum + p.buyIns * stackPerBuyIn(game), 0);
}

/** Sum of all entered final stacks, in stack units (cents or chips). */
export function totalFinalStack(game: Game): number {
  return game.players.reduce((sum, p) => sum + (p.final ?? 0), 0);
}

/**
 * Win (+) or loss (-) of a single player in cents. In chip mode this is
 * rounded to the nearest cent; use `netsCents` for the exact settlement.
 */
export function playerNetCents(player: Player, game: Game): number {
  const diff = (player.final ?? 0) - player.buyIns * stackPerBuyIn(game);
  if (game.chipsPerBuyIn === null) return diff;
  return Math.round((diff * game.buyInCents) / game.chipsPerBuyIn);
}

/**
 * Win (+) or loss (-) of every player in cents, in the same order as
 * `game.players`. In chip mode the chip difference is converted to money;
 * rounding leftovers go to the players with the largest remainders so the
 * nets still sum to exactly zero.
 */
export function netsCents(game: Game): number[] {
  const perBuyIn = stackPerBuyIn(game);
  const diffs = game.players.map((p) => (p.final ?? 0) - p.buyIns * perBuyIn);
  if (game.chipsPerBuyIn === null) return diffs;

  const chips = game.chipsPerBuyIn;
  const scaled = diffs.map((d) => d * game.buyInCents);
  const nets = scaled.map((s) => Math.floor(s / chips));
  const remainders = scaled.map((s, i) => s - nets[i] * chips);
  const missing = Math.round(remainders.reduce((a, b) => a + b, 0) / chips);
  const order = remainders
    .map((r, i) => ({ r, i }))
    .sort((a, b) => b.r - a.r || a.i - b.i);
  for (let k = 0; k < missing && k < order.length; k++) nets[order[k].i] += 1;
  return nets;
}

/**
 * Computes who pays whom. Greedily matches the biggest loser with the biggest
 * winner, which needs at most (players - 1) transfers.
 * Requires the nets to sum to zero (i.e. final stacks == pot).
 */
export function settle(game: Game): Transfer[] {
  const nets = netsCents(game);
  const debtors = game.players
    .map((p, i) => ({ name: p.name, amount: -nets[i] }))
    .filter((d) => d.amount > 0);
  const creditors = game.players
    .map((p, i) => ({ name: p.name, amount: nets[i] }))
    .filter((c) => c.amount > 0);

  const transfers: Transfer[] = [];
  while (debtors.length > 0 && creditors.length > 0) {
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);
    const debtor = debtors[0];
    const creditor = creditors[0];
    const cents = Math.min(debtor.amount, creditor.amount);
    transfers.push({ from: debtor.name, to: creditor.name, cents });
    debtor.amount -= cents;
    creditor.amount -= cents;
    if (debtor.amount === 0) debtors.shift();
    if (creditor.amount === 0) creditors.shift();
  }
  return transfers;
}

/** Players with their net result, biggest winner first. */
export function ranking(game: Game): { player: Player; net: number }[] {
  const nets = netsCents(game);
  return game.players
    .map((player, i) => ({ player, net: nets[i] }))
    .sort((a, b) => b.net - a.net);
}

export function buyInLabel(game: Game): string {
  const money = formatMoney(game.buyInCents, game.currency);
  return game.chipsPerBuyIn === null ? money : `${money} = ${formatChips(game.chipsPerBuyIn)}`;
}

export function resultText(game: Game): string {
  const lines: string[] = [];
  lines.push(`Poker-Abrechnung (Buy-in ${buyInLabel(game)})`);
  lines.push('');
  for (const { player, net } of ranking(game)) {
    lines.push(
      `${player.name}: ${formatMoney(net, game.currency, true)} ` +
        `(${player.buyIns}x eingekauft, Ende ${formatStack(player.final ?? 0, game)})`,
    );
  }
  lines.push('');
  const transfers = settle(game);
  if (transfers.length === 0) {
    lines.push('Niemand schuldet jemandem etwas.');
  } else {
    lines.push('Zahlungen:');
    for (const t of transfers) {
      lines.push(`• ${t.from} → ${t.to}: ${formatMoney(t.cents, game.currency)}`);
    }
  }
  return lines.join('\n');
}
