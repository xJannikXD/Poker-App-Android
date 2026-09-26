import { StatusBar } from 'expo-status-bar';
import { ReactNode, useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import {
  buyInLabel,
  formatChips,
  formatMoney,
  formatStack,
  Game,
  investedCents,
  newGame,
  newId,
  parseChips,
  parseMoney,
  parseStack,
  Player,
  playerNetCents,
  ranking,
  resultText,
  settle,
  totalFinalStack,
  totalPotCents,
  totalPotStack,
} from './src/logic';
import { loadGame, saveGame } from './src/storage';

const C = {
  bg: '#0f3d2e',
  card: '#16513d',
  cardLight: '#1d6049',
  text: '#f4f1e8',
  muted: '#b5c9bf',
  gold: '#e8b93a',
  red: '#ff7b72',
  green: '#7ee2a8',
  input: '#0b2e22',
};

function confirm(title: string, message: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onYes();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Abbrechen', style: 'cancel' },
    { text: 'Ja', style: 'destructive', onPress: onYes },
  ]);
}

/** Returns an error message if the name can't be added, otherwise null. */
function nameError(name: string, players: Player[]): string | null {
  const trimmed = name.trim().toLowerCase();
  if (trimmed && players.some((p) => p.name.toLowerCase() === trimmed)) {
    return 'Name ist schon vergeben';
  }
  return null;
}

function addPlayer(game: Game, name: string): Game | null {
  const trimmed = name.trim();
  if (!trimmed || nameError(trimmed, game.players)) return null;
  return {
    ...game,
    players: [...game.players, { id: newId(), name: trimmed, buyIns: 1, final: null }],
  };
}

export default function App() {
  const [game, setGame] = useState<Game | null>(null);

  useEffect(() => {
    loadGame().then((g) => setGame(g ?? newGame()));
  }, []);

  useEffect(() => {
    if (game) saveGame(game);
  }, [game]);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        {/* Android draws edge-to-edge, so the keyboard needs padding there as well. */}
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          {game && <Screen game={game} setGame={setGame} />}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

type ScreenProps = { game: Game; setGame: (g: Game) => void };

function Screen(props: ScreenProps) {
  switch (props.game.phase) {
    case 'setup':
      return <SetupScreen {...props} />;
    case 'playing':
      return <PlayingScreen {...props} />;
    case 'ending':
      return <EndingScreen {...props} />;
    case 'result':
      return <ResultScreen {...props} />;
  }
}

// ---------------------------------------------------------------- Setup

function SetupScreen({ game, setGame }: ScreenProps) {
  const [buyIn, setBuyIn] = useState(formatMoney(game.buyInCents, '').trim());
  const [chips, setChips] = useState(String(game.chipsPerBuyIn ?? 1000));
  const [name, setName] = useState('');
  const buyInCents = parseMoney(buyIn);
  const chipsPerBuyIn = parseChips(chips);
  const chipMode = game.chipsPerBuyIn !== null;
  const buyInValid = buyInCents !== null && buyInCents > 0;
  const chipsValid = !chipMode || (chipsPerBuyIn !== null && chipsPerBuyIn > 0);

  const submitName = () => {
    const next = addPlayer(game, name);
    if (next) {
      setGame(next);
      setName('');
    }
  };

  const setChipMode = (on: boolean) =>
    setGame({ ...game, chipsPerBuyIn: on ? (chipsPerBuyIn && chipsPerBuyIn > 0 ? chipsPerBuyIn : 1000) : null });

  const canStart = game.players.length >= 2 && buyInValid && chipsValid;

  return (
    <Page title="Neues Spiel" subtitle="Start-Geld festlegen und Spieler hinzufügen">
      <Card>
        <Label>Start-Geld pro Einkauf</Label>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={buyIn}
            onChangeText={(t) => {
              setBuyIn(t);
              const cents = parseMoney(t);
              if (cents !== null && cents > 0) setGame({ ...game, buyInCents: cents });
            }}
            keyboardType="decimal-pad"
            placeholder="z.B. 10"
            placeholderTextColor={C.muted}
          />
          <TextInput
            style={[styles.input, { width: 64, marginLeft: 8, textAlign: 'center' }]}
            value={game.currency}
            onChangeText={(t) => setGame({ ...game, currency: t.slice(0, 3) })}
            placeholder="€"
            placeholderTextColor={C.muted}
          />
        </View>
        {!buyInValid && buyIn !== '' && <Text style={styles.error}>Ungültiger Betrag</Text>}

        <Text style={[styles.label, { marginTop: 18 }]}>Endstände zählen in</Text>
        <Segmented
          options={['Geld', 'Chips']}
          selected={chipMode ? 1 : 0}
          onSelect={(i) => setChipMode(i === 1)}
        />
        {chipMode && (
          <>
            <View style={[styles.row, { marginTop: 10 }]}>
              <Text style={[styles.muted, { flex: 1, fontSize: 15 }]}>
                {formatMoney(buyInValid ? buyInCents : game.buyInCents, game.currency)} =
              </Text>
              <TextInput
                style={[styles.input, { width: 120, textAlign: 'right' }]}
                value={chips}
                onChangeText={(t) => {
                  setChips(t);
                  const value = parseChips(t);
                  if (value !== null && value > 0) setGame({ ...game, chipsPerBuyIn: value });
                }}
                keyboardType="number-pad"
                placeholder="1000"
                placeholderTextColor={C.muted}
              />
              <Text style={[styles.muted, { marginLeft: 8, fontSize: 15 }]}>Chips</Text>
            </View>
            {!chipsValid && <Text style={styles.error}>Ungültige Chip-Anzahl</Text>}
          </>
        )}
      </Card>

      <Card>
        <Label>Spieler ({game.players.length})</Label>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={name}
            onChangeText={setName}
            placeholder="Name"
            placeholderTextColor={C.muted}
            onSubmitEditing={submitName}
            submitBehavior="submit"
            returnKeyType="done"
            autoCapitalize="words"
          />
          <Button label="+" onPress={submitName} style={{ marginLeft: 8, width: 52 }} />
        </View>
        {nameError(name, game.players) && (
          <Text style={styles.error}>{nameError(name, game.players)}</Text>
        )}
        {game.players.map((p) => (
          <View key={p.id} style={styles.listRow}>
            <Text style={styles.playerName}>{p.name}</Text>
            <Pressable
              hitSlop={10}
              onPress={() =>
                setGame({ ...game, players: game.players.filter((x) => x.id !== p.id) })
              }
            >
              <Text style={{ color: C.red, fontSize: 18 }}>✕</Text>
            </Pressable>
          </View>
        ))}
      </Card>

      <Button
        label="Spiel starten"
        disabled={!canStart}
        onPress={() => setGame({ ...game, phase: 'playing', startedAt: Date.now() })}
        big
      />
      {game.players.length < 2 && <Text style={styles.hint}>Mindestens 2 Spieler nötig</Text>}
    </Page>
  );
}

// ---------------------------------------------------------------- Playing

function PlayingScreen({ game, setGame }: ScreenProps) {
  const [lateName, setLateName] = useState('');
  const [cashOutId, setCashOutId] = useState<string | null>(null);
  const [cashOutText, setCashOutText] = useState('');
  const chipMode = game.chipsPerBuyIn !== null;
  const pot = totalPotCents(game);
  const cashedOut = game.players.reduce((sum, p) => sum + (p.out ? (p.final ?? 0) : 0), 0);
  const cashOutValue = parseStack(cashOutText, game);
  // Players still at the table first, those who left at the bottom.
  const players = [...game.players.filter((p) => !p.out), ...game.players.filter((p) => p.out)];

  const updatePlayer = (id: string, change: Partial<Player>) =>
    setGame({
      ...game,
      players: game.players.map((p) => (p.id === id ? { ...p, ...change } : p)),
    });

  const startCashOut = (p: Player) => {
    setCashOutId(p.id);
    setCashOutText('');
  };

  const confirmCashOut = () => {
    if (cashOutId === null || cashOutValue === null || cashOutValue < 0) return;
    updatePlayer(cashOutId, { out: true, final: cashOutValue });
    setCashOutId(null);
  };

  const bringBack = (p: Player) =>
    confirm('Zurückholen?', `${p.name} spielt wieder mit, der eingetragene Stand wird gelöscht.`, () =>
      updatePlayer(p.id, { out: false, final: null }),
    );

  const changeBuyIns = (id: string, delta: number) =>
    setGame({
      ...game,
      players: game.players.map((p) =>
        p.id === id ? { ...p, buyIns: Math.max(1, p.buyIns + delta) } : p,
      ),
    });

  const undoOrRemove = (p: Player) => {
    if (p.buyIns > 1) {
      confirm('Rebuy zurücknehmen?', `Einen Einkauf von ${p.name} entfernen.`, () =>
        changeBuyIns(p.id, -1),
      );
    } else {
      confirm('Spieler entfernen?', `${p.name} wird aus dem Spiel entfernt.`, () =>
        setGame({ ...game, players: game.players.filter((x) => x.id !== p.id) }),
      );
    }
  };

  const submitLateName = () => {
    const next = addPlayer(game, lateName);
    if (next) {
      setGame(next);
      setLateName('');
    }
  };

  return (
    <Page title="Spiel läuft" subtitle={`Start-Geld: ${buyInLabel(game)}`}>
      <View style={styles.potBox}>
        <Text style={styles.potLabel}>Im Topf</Text>
        <Text style={styles.potValue}>{formatMoney(pot, game.currency)}</Text>
        {chipMode && (
          <Text style={styles.potLabel}>{formatChips(totalPotStack(game))} im Spiel</Text>
        )}
        {cashedOut > 0 && (
          <Text style={styles.potLabel}>
            Noch am Tisch: {formatStack(totalPotStack(game) - cashedOut, game)}
          </Text>
        )}
      </View>

      <Card>
        {players.map((p) =>
          p.out ? (
            <View key={p.id} style={styles.playerBlock}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.playerName, { color: C.muted }]}>{p.name} · ausgestiegen</Text>
                  <Text style={styles.muted}>
                    {p.buyIns}× eingekauft · raus mit {formatStack(p.final ?? 0, game)} ·{' '}
                    <NetText cents={playerNetCents(p, game)} currency={game.currency} />
                  </Text>
                </View>
                <Button label="Zurückholen" small secondary onPress={() => bringBack(p)} />
              </View>
            </View>
          ) : (
            <View key={p.id} style={styles.playerBlock}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.playerName}>{p.name}</Text>
                  <Text style={styles.muted}>
                    {p.buyIns}× eingekauft · {formatMoney(investedCents(p, game.buyInCents), game.currency)}
                  </Text>
                  <Pressable hitSlop={8} onPress={() => startCashOut(p)}>
                    <Text style={styles.link}>Aussteigen ›</Text>
                  </Pressable>
                </View>
                <Button
                  label="−"
                  small
                  secondary
                  onPress={() => undoOrRemove(p)}
                  style={{ marginRight: 8, width: 40 }}
                />
                <Button label="+ Rebuy" small onPress={() => changeBuyIns(p.id, 1)} />
              </View>
              {cashOutId === p.id && (
                <View style={styles.cashOutBox}>
                  <Text style={[styles.muted, { marginBottom: 8 }]}>
                    Mit {chipMode ? 'wie vielen Chips' : 'wie viel Geld'} steigt {p.name} aus?
                  </Text>
                  <View style={styles.row}>
                    <TextInput
                      style={[styles.input, { flex: 1, minWidth: 0, textAlign: 'right' }]}
                      value={cashOutText}
                      onChangeText={setCashOutText}
                      onSubmitEditing={confirmCashOut}
                      keyboardType={chipMode ? 'number-pad' : 'decimal-pad'}
                      placeholder={chipMode ? 'Chips' : '0'}
                      placeholderTextColor={C.muted}
                      autoFocus
                    />
                    <Button
                      label="OK"
                      small
                      disabled={cashOutValue === null || cashOutValue < 0}
                      onPress={confirmCashOut}
                      style={{ marginLeft: 8, width: 52 }}
                    />
                    <Button
                      label="✕"
                      small
                      secondary
                      onPress={() => setCashOutId(null)}
                      style={{ marginLeft: 8, width: 40 }}
                    />
                  </View>
                  {cashOutValue !== null && cashOutValue >= 0 && (
                    <Text style={[styles.muted, { marginTop: 8 }]}>
                      Ergebnis:{' '}
                      <NetText
                        cents={playerNetCents({ ...p, final: cashOutValue }, game)}
                        currency={game.currency}
                      />
                    </Text>
                  )}
                </View>
              )}
            </View>
          ),
        )}
      </Card>

      <Card>
        <Label>Spieler kommt dazu</Label>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={lateName}
            onChangeText={setLateName}
            placeholder="Name"
            placeholderTextColor={C.muted}
            onSubmitEditing={submitLateName}
            autoCapitalize="words"
          />
          <Button label="+" onPress={submitLateName} style={{ marginLeft: 8, width: 52 }} />
        </View>
        {nameError(lateName, game.players) && (
          <Text style={styles.error}>{nameError(lateName, game.players)}</Text>
        )}
      </Card>

      <Button
        label="Spiel beenden – Endstände eingeben"
        disabled={game.players.length < 2}
        onPress={() => setGame({ ...game, phase: 'ending' })}
        big
      />
      <Button
        label="Spiel abbrechen"
        secondary
        onPress={() =>
          confirm('Spiel abbrechen?', 'Alle Daten dieses Spiels gehen verloren.', () =>
            setGame(newGame()),
          )
        }
        style={{ marginTop: 12 }}
      />
    </Page>
  );
}

// ---------------------------------------------------------------- Ending

function stackInputText(value: number | null, game: Game): string {
  if (value === null) return '';
  if (game.chipsPerBuyIn !== null) return String(value);
  return formatMoney(value, '').trim().replace(/\./g, '');
}

function EndingScreen({ game, setGame }: ScreenProps) {
  const chipMode = game.chipsPerBuyIn !== null;
  const [inputs, setInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(game.players.map((p) => [p.id, stackInputText(p.final, game)])),
  );

  const setInput = (id: string, text: string) => {
    setInputs((prev) => ({ ...prev, [id]: text }));
    const value = text.trim() === '' ? null : parseStack(text, game);
    setGame({
      ...game,
      players: game.players.map((p) =>
        p.id === id ? { ...p, final: value !== null && value >= 0 ? value : null } : p,
      ),
    });
  };

  const pot = totalPotStack(game);
  const entered = totalFinalStack(game);
  const diff = entered - pot;
  const allEntered = game.players.every((p) => p.final !== null);
  const invalidIds = game.players
    .filter((p) => (inputs[p.id]?.trim() ?? '') !== '' && p.final === null)
    .map((p) => p.id);

  return (
    <Page
      title="Endstände"
      subtitle={
        chipMode
          ? 'Wie viele Chips hat jeder am Ende vor sich?'
          : 'Wie viel Geld hat jeder am Ende vor sich?'
      }
    >
      <Card>
        {game.players.map((p) => (
          <View key={p.id} style={styles.playerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.playerName}>{p.name}</Text>
              <Text style={styles.muted}>
                {p.out ? 'ausgestiegen · ' : ''}
                {chipMode
                  ? `${p.buyIns}× eingekauft · ${formatChips(p.buyIns * game.chipsPerBuyIn!)}`
                  : `eingezahlt ${formatMoney(investedCents(p, game.buyInCents), game.currency)}`}
              </Text>
            </View>
            <TextInput
              style={[
                styles.input,
                { width: 120, textAlign: 'right' },
                invalidIds.includes(p.id) && { borderColor: C.red },
              ]}
              value={inputs[p.id] ?? ''}
              onChangeText={(t) => setInput(p.id, t)}
              keyboardType={chipMode ? 'number-pad' : 'decimal-pad'}
              placeholder={chipMode ? 'Chips' : '0'}
              placeholderTextColor={C.muted}
            />
          </View>
        ))}
        {invalidIds.length > 0 && (
          <Text style={styles.error}>
            {chipMode ? 'Bitte ganze Chip-Anzahl eingeben.' : 'Bitte gültigen Betrag eingeben.'}
          </Text>
        )}
      </Card>

      <Card>
        <SummaryRow
          label={chipMode ? 'Chips im Spiel (alle Einkäufe)' : 'Im Topf (alle Einkäufe)'}
          value={formatStack(pot, game)}
        />
        <SummaryRow label="Eingegebene Endstände" value={formatStack(entered, game)} />
        <SummaryRow
          label="Differenz"
          value={formatStack(diff, game, true)}
          color={diff === 0 ? C.green : C.red}
        />
        {diff !== 0 && allEntered && (
          <Text style={styles.error}>
            {diff > 0
              ? `Es wurde${chipMode ? 'n' : ''} ${formatStack(diff, game)} zu viel eingetragen.`
              : `Es fehlen noch ${formatStack(-diff, game)}.`}{' '}
            Bitte nochmal nachzählen – die Endstände müssen genau dem Topf entsprechen.
          </Text>
        )}
      </Card>

      <Button
        label="Abrechnen"
        big
        disabled={!allEntered || diff !== 0}
        onPress={() => setGame({ ...game, phase: 'result' })}
      />
      <Button
        label="Zurück zum Spiel"
        secondary
        onPress={() => setGame({ ...game, phase: 'playing' })}
        style={{ marginTop: 12 }}
      />
    </Page>
  );
}

// ---------------------------------------------------------------- Result

function ResultScreen({ game, setGame }: ScreenProps) {
  const transfers = settle(game);

  const share = () => {
    Share.share({ message: resultText(game) }).catch(() => {
      // Sharing is not supported everywhere (e.g. some desktop browsers).
      Alert.alert('Teilen nicht möglich', resultText(game));
    });
  };

  const restartSamePlayers = () =>
    confirm('Neues Spiel?', 'Die aktuelle Abrechnung wird gelöscht.', () =>
      setGame({
        ...game,
        phase: 'setup',
        startedAt: null,
        players: game.players.map((p) => ({ id: newId(), name: p.name, buyIns: 1, final: null })),
      }),
    );

  return (
    <Page title="Abrechnung" subtitle="Wer zahlt wem wie viel">
      <Card>
        <Label>Zahlungen</Label>
        {transfers.length === 0 ? (
          <Text style={styles.playerName}>Niemand schuldet jemandem etwas 🎉</Text>
        ) : (
          transfers.map((t, i) => (
            <View key={i} style={styles.transfer}>
              <Text style={styles.transferNames}>
                <Text style={{ color: C.red }}>{t.from}</Text>
                <Text style={{ color: C.muted }}>{'  zahlt an  '}</Text>
                <Text style={{ color: C.green }}>{t.to}</Text>
              </Text>
              <Text style={styles.transferAmount}>{formatMoney(t.cents, game.currency)}</Text>
            </View>
          ))
        )}
      </Card>

      <Card>
        <Label>Ergebnis pro Spieler</Label>
        {ranking(game).map(({ player: p, net }) => (
          <View key={p.id} style={styles.playerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.playerName}>{p.name}</Text>
              <Text style={styles.muted}>
                {p.buyIns}× eingekauft ({formatMoney(investedCents(p, game.buyInCents), game.currency)}) · Ende{' '}
                {formatStack(p.final ?? 0, game)}
              </Text>
            </View>
            <Text
              style={[styles.netValue, { color: net > 0 ? C.green : net < 0 ? C.red : C.muted }]}
            >
              {formatMoney(net, game.currency, true)}
            </Text>
          </View>
        ))}
      </Card>

      <Button label="Ergebnis teilen" big onPress={share} />
      <Button
        label="Endstände korrigieren"
        secondary
        onPress={() => setGame({ ...game, phase: 'ending' })}
        style={{ marginTop: 12 }}
      />
      <Button
        label="Neues Spiel (gleiche Spieler)"
        secondary
        onPress={restartSamePlayers}
        style={{ marginTop: 12 }}
      />
      <Button
        label="Neues Spiel"
        secondary
        onPress={() =>
          confirm('Neues Spiel?', 'Die aktuelle Abrechnung wird gelöscht.', () =>
            setGame({
              ...newGame(),
              buyInCents: game.buyInCents,
              currency: game.currency,
              chipsPerBuyIn: game.chipsPerBuyIn,
            }),
          )
        }
        style={{ marginTop: 12 }}
      />
    </Page>
  );
}

// ---------------------------------------------------------------- UI bits

function Page({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>♠ {title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {children}
    </ScrollView>
  );
}

function NetText({ cents, currency }: { cents: number; currency: string }) {
  const color = cents > 0 ? C.green : cents < 0 ? C.red : C.muted;
  return <Text style={{ color, fontWeight: '700' }}>{formatMoney(cents, currency, true)}</Text>;
}

function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function Label({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

function SummaryRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={[styles.summaryValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

function Segmented({
  options,
  selected,
  onSelect,
}: {
  options: string[];
  selected: number;
  onSelect: (index: number) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((option, i) => (
        <Pressable
          key={option}
          onPress={() => onSelect(i)}
          style={[styles.segment, i === selected && styles.segmentActive]}
        >
          <Text style={[styles.segmentText, i === selected && { color: '#1a1a1a' }]}>{option}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Button({
  label,
  onPress,
  disabled,
  secondary,
  small,
  big,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  small?: boolean;
  big?: boolean;
  style?: object;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.buttonSecondary,
        small && styles.buttonSmall,
        big && styles.buttonBig,
        disabled && { opacity: 0.4 },
        pressed && { opacity: 0.7 },
        style,
      ]}
    >
      <Text style={[styles.buttonText, secondary && { color: C.text }, big && { fontSize: 17 }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  page: { padding: 16, paddingBottom: 48 },
  title: { color: C.text, fontSize: 28, fontWeight: '700', marginTop: 8 },
  subtitle: { color: C.muted, fontSize: 15, marginTop: 4, marginBottom: 16 },
  card: { backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 14 },
  label: {
    color: C.gold,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  input: {
    backgroundColor: C.input,
    color: C.text,
    fontSize: 17,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  error: { color: C.red, marginTop: 8, fontSize: 14 },
  hint: { color: C.muted, textAlign: 'center', marginTop: 8 },
  muted: { color: C.muted, fontSize: 13, marginTop: 2 },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.cardLight,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.cardLight,
  },
  playerBlock: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.cardLight,
  },
  link: { color: C.gold, fontSize: 14, fontWeight: '600', marginTop: 6 },
  cashOutBox: { backgroundColor: C.cardLight, borderRadius: 10, padding: 10, marginTop: 10 },
  playerName: { color: C.text, fontSize: 17, fontWeight: '600' },
  potBox: { alignItems: 'center', marginBottom: 14 },
  potLabel: { color: C.muted, fontSize: 14 },
  potValue: { color: C.gold, fontSize: 40, fontWeight: '800' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  summaryValue: { color: C.text, fontSize: 15, fontWeight: '600' },
  transfer: {
    backgroundColor: C.cardLight,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  transferNames: { fontSize: 16, fontWeight: '600', flex: 1 },
  transferAmount: { color: C.gold, fontSize: 18, fontWeight: '800', marginLeft: 8 },
  netValue: { fontSize: 17, fontWeight: '800', marginLeft: 8 },
  button: {
    backgroundColor: C.gold,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.muted },
  buttonSmall: { paddingVertical: 8, paddingHorizontal: 12 },
  buttonBig: { paddingVertical: 16 },
  buttonText: { color: '#1a1a1a', fontSize: 16, fontWeight: '700' },
  segmented: { flexDirection: 'row', backgroundColor: C.input, borderRadius: 10, padding: 3 },
  segment: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  segmentActive: { backgroundColor: C.gold },
  segmentText: { color: C.text, fontSize: 15, fontWeight: '600' },
});
