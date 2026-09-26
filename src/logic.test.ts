import { describe, expect, it } from '@jest/globals';

import { formatMoney, Game, netCents, parseMoney, settle, totalFinalCents, totalPotCents } from './logic';

function game(buyInCents: number, players: [string, number, number][]): Game {
  return {
    phase: 'result',
    buyInCents,
    currency: '€',
    startedAt: 0,
    players: players.map(([name, buyIns, finalCents], i) => ({
      id: String(i),
      name,
      buyIns,
      finalCents,
    })),
  };
}

describe('parseMoney', () => {
  it.each([
    ['10', 1000],
    ['10,5', 1050],
    ['10.50', 1050],
    ['0,05', 5],
    ['1.234,56', 123456],
    ['1,234.56', 123456],
    [' 20 € ', 2000],
    ['', null],
    ['abc', null],
    ['1,234', null],
  ])('parses %p', (input, expected) => {
    expect(parseMoney(input)).toBe(expected);
  });
});

describe('formatMoney', () => {
  it('formats German style', () => {
    expect(formatMoney(123456, '€')).toBe('1.234,56 €');
    expect(formatMoney(1000, '€')).toBe('10 €');
    expect(formatMoney(-550, '€')).toBe('-5,50 €');
    expect(formatMoney(550, '€', true)).toBe('+5,50 €');
  });
});

describe('settle', () => {
  it('handles re-buys and balances out', () => {
    // Buy-in 10 €. Anna rebought twice (30 € in), Ben once (10 €), Cleo once (10 €).
    const g = game(1000, [
      ['Anna', 3, 0],
      ['Ben', 1, 3500],
      ['Cleo', 1, 1500],
    ]);
    expect(totalPotCents(g)).toBe(5000);
    expect(g.players.map((p) => netCents(p, g.buyInCents))).toEqual([-3000, 2500, 500]);
    expect(settle(g)).toEqual([
      { from: 'Anna', to: 'Ben', cents: 2500 },
      { from: 'Anna', to: 'Cleo', cents: 500 },
    ]);
  });

  it('needs at most n-1 transfers and every net is settled', () => {
    const g = game(2000, [
      ['A', 2, 0],
      ['B', 1, 500],
      ['C', 3, 9000],
      ['D', 1, 4500],
      ['E', 2, 4000],
    ]);
    expect(totalFinalCents(g)).toBe(totalPotCents(g));
    const transfers = settle(g);
    expect(transfers.length).toBeLessThanOrEqual(4);
    const balance = new Map(g.players.map((p) => [p.name, netCents(p, g.buyInCents)]));
    for (const t of transfers) {
      expect(t.cents).toBeGreaterThan(0);
      balance.set(t.from, balance.get(t.from)! + t.cents);
      balance.set(t.to, balance.get(t.to)! - t.cents);
    }
    for (const v of balance.values()) expect(v).toBe(0);
  });

  it('returns nothing when everybody breaks even', () => {
    expect(settle(game(1000, [['A', 1, 1000], ['B', 2, 2000]]))).toEqual([]);
  });
});
