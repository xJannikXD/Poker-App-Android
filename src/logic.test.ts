import { describe, expect, it } from '@jest/globals';

import {
  formatChips,
  formatMoney,
  Game,
  netsCents,
  parseChips,
  parseMoney,
  playerNetCents,
  resultText,
  settle,
  totalFinalStack,
  totalPotCents,
  totalPotStack,
} from './logic';

function game(
  buyInCents: number,
  players: [string, number, number][],
  chipsPerBuyIn: number | null = null,
): Game {
  return {
    phase: 'result',
    buyInCents,
    currency: '€',
    chipsPerBuyIn,
    startedAt: 0,
    players: players.map(([name, buyIns, final], i) => ({
      id: String(i),
      name,
      buyIns,
      final,
    })),
  };
}

/** Applies all transfers and checks that everybody ends up even. */
function expectFullySettled(g: Game) {
  const nets = netsCents(g);
  expect(nets.reduce((a, b) => a + b, 0)).toBe(0);
  const balance = new Map(g.players.map((p, i) => [p.name, nets[i]]));
  const transfers = settle(g);
  expect(transfers.length).toBeLessThanOrEqual(Math.max(0, g.players.length - 1));
  for (const t of transfers) {
    expect(t.cents).toBeGreaterThan(0);
    balance.set(t.from, balance.get(t.from)! + t.cents);
    balance.set(t.to, balance.get(t.to)! - t.cents);
  }
  for (const v of balance.values()) expect(v).toBe(0);
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

describe('parseChips', () => {
  it.each([
    ['1500', 1500],
    ['1.500', 1500],
    [' 0 ', 0],
    ['', null],
    ['12,5', null],
    ['-5', null],
  ])('parses %p', (input, expected) => {
    expect(parseChips(input)).toBe(expected);
  });
});

describe('formatting', () => {
  it('formats money German style', () => {
    expect(formatMoney(123456, '€')).toBe('1.234,56 €');
    expect(formatMoney(1000, '€')).toBe('10 €');
    expect(formatMoney(-550, '€')).toBe('-5,50 €');
    expect(formatMoney(550, '€', true)).toBe('+5,50 €');
  });

  it('formats chips', () => {
    expect(formatChips(12500)).toBe('12.500 Chips');
    expect(formatChips(-300, true)).toBe('-300 Chips');
  });
});

describe('settle (money)', () => {
  it('handles re-buys and balances out', () => {
    // Buy-in 10 €. Anna rebought twice (30 € in), Ben once (10 €), Cleo once (10 €).
    const g = game(1000, [
      ['Anna', 3, 0],
      ['Ben', 1, 3500],
      ['Cleo', 1, 1500],
    ]);
    expect(totalPotCents(g)).toBe(5000);
    expect(netsCents(g)).toEqual([-3000, 2500, 500]);
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
    expect(totalFinalStack(g)).toBe(totalPotStack(g));
    expectFullySettled(g);
  });

  it('returns nothing when everybody breaks even', () => {
    expect(settle(game(1000, [['A', 1, 1000], ['B', 2, 2000]]))).toEqual([]);
  });
});

describe('settle (chips)', () => {
  it('converts chips to money', () => {
    // 10 € = 1000 chips.
    const g = game(
      1000,
      [
        ['Anna', 2, 0],
        ['Ben', 1, 2500],
        ['Cleo', 1, 1500],
      ],
      1000,
    );
    expect(totalPotStack(g)).toBe(4000);
    expect(netsCents(g)).toEqual([-2000, 1500, 500]);
    expect(settle(g)).toEqual([
      { from: 'Anna', to: 'Ben', cents: 1500 },
      { from: 'Anna', to: 'Cleo', cents: 500 },
    ]);
  });

  it('distributes rounding cents so the result still adds up', () => {
    // 10 € = 300 chips, so 100 chips are worth 3,333… €.
    const g = game(
      1000,
      [
        ['A', 1, 400],
        ['B', 1, 100],
        ['C', 1, 400],
      ],
      300,
    );
    expect(netsCents(g)).toEqual([334, -667, 333]);
    expectFullySettled(g);
  });

  it('stays exact over many odd splits', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const chips = 7 + (seed % 13) * 37;
      const buyIns = [1 + (seed % 3), 1, 2, 1 + (seed % 2)];
      const total = buyIns.reduce((a, b) => a + b, 0) * chips;
      const a = (seed * 7919) % (total + 1);
      const b = (seed * 104729) % (total - a + 1);
      const c = (seed * 31) % (total - a - b + 1);
      const finals = [a, b, c, total - a - b - c];
      const g = game(
        500 + seed,
        finals.map((f, i): [string, number, number] => [`P${i}`, buyIns[i], f]),
        chips,
      );
      expectFullySettled(g);
    }
  });
});

describe('resultText', () => {
  it('lists results and payments', () => {
    const g = game(1000, [['Anna', 2, 0], ['Ben', 1, 3000]], 1000);
    const text = resultText(g);
    expect(text).toContain('Buy-in 10 € = 1.000 Chips');
    expect(text).toContain('Ben: +20 € (1x eingekauft, Ende 3.000 Chips)');
    expect(text).toContain('• Anna → Ben: 20 €');
  });
});

describe('playerNetCents', () => {
  it('shows the result of a single player', () => {
    const money = game(1000, [['Anna', 2, 500]]);
    expect(playerNetCents(money.players[0], money)).toBe(-1500);
    const chips = game(1000, [['Anna', 1, 400]], 300);
    expect(playerNetCents(chips.players[0], chips)).toBe(333);
  });
});
