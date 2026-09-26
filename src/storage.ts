import AsyncStorage from '@react-native-async-storage/async-storage';

import { Game } from './logic';

const KEY = 'poker-game-v2';
const PHASES = ['setup', 'playing', 'ending', 'result'];

function isGame(value: unknown): value is Game {
  const g = value as Game;
  return (
    typeof g === 'object' &&
    g !== null &&
    PHASES.includes(g.phase) &&
    typeof g.buyInCents === 'number' &&
    Array.isArray(g.players) &&
    g.players.every((p) => typeof p.name === 'string' && typeof p.buyIns === 'number')
  );
}

export async function loadGame(): Promise<Game | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return isGame(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveGame(game: Game): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(game));
  } catch {
    // Losing the autosave is not fatal; the game keeps running in memory.
  }
}
