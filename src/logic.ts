// Pure game logic: no React, no storage. All money values are integer cents
// so that sums never suffer from floating point rounding.

export type Player = {
  id: string;
  name: string;
  /** How often the player bought in (initial buy-in counts as 1). */
  buyIns: number;
  /** Final stack in cents, entered at the end of the game. */
  finalCents: number | null;
};

export type Phase = 'setup' | 'playing' | 'ending' | 'result';

export type Game = {
  phase: Phase;
  buyInCents: number;
  currency: string;
  players: Player[];
  startedAt: number | null;
};

export type Transfer = { from: string; to: string; cents: number };

export function newGame(): Game {
  return { phase: 'setup', buyInCents: 1000, currency: '€', players: [], startedAt: null };
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

export function formatMoney(cents: number, currency: string, withSign = false): string {
  const sign = cents < 0 ? '-' : withSign && cents > 0 ? '+' : '';
  const abs = Math.abs(cents);
  const euros = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const rest = abs % 100;
  const amount = rest === 0 ? euros : `${euros},${rest.toString().padStart(2, '0')}`;
  return `${sign}${amount} ${currency}`.trim();
}

export function investedCents(player: Player, buyInCents: number): number {
  return player.buyIns * buyInCents;
}

export function totalPotCents(game: Game): number {
  return game.players.reduce((sum, p) => sum + investedCents(p, game.buyInCents), 0);
}

export function totalFinalCents(game: Game): number {
  return game.players.reduce((sum, p) => sum + (p.finalCents ?? 0), 0);
}

/** Final stack minus everything the player paid in. Positive = won. */
export function netCents(player: Player, buyInCents: number): number {
  return (player.finalCents ?? 0) - investedCents(player, buyInCents);
}

/**
 * Computes who pays whom. Greedily matches the biggest loser with the biggest
 * winner, which needs at most (players - 1) transfers.
 * Requires the nets to sum to zero (i.e. final stacks == pot).
 */
export function settle(game: Game): Transfer[] {
  const debtors = game.players
    .map((p) => ({ name: p.name, amount: -netCents(p, game.buyInCents) }))
    .filter((d) => d.amount > 0);
  const creditors = game.players
    .map((p) => ({ name: p.name, amount: netCents(p, game.buyInCents) }))
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

export function resultText(game: Game): string {
  const lines: string[] = [];
  lines.push(`Poker-Abrechnung (Buy-in ${formatMoney(game.buyInCents, game.currency)})`);
  lines.push('');
  const sorted = [...game.players].sort(
    (a, b) => netCents(b, game.buyInCents) - netCents(a, game.buyInCents),
  );
  for (const p of sorted) {
    lines.push(
      `${p.name}: ${formatMoney(netCents(p, game.buyInCents), game.currency, true)} ` +
        `(${p.buyIns}x eingekauft, Ende ${formatMoney(p.finalCents ?? 0, game.currency)})`,
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
