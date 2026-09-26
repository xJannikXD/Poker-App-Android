import AsyncStorage from '@react-native-async-storage/async-storage';

import { Game } from './logic';

const KEY = 'poker-game-v1';

export async function loadGame(): Promise<Game | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Game) : null;
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
