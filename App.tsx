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
  formatMoney,
  Game,
  investedCents,
  netCents,
  newGame,
  newId,
  parseMoney,
  resultText,
  settle,
  totalFinalCents,
  totalPotCents,
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
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
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
  const [name, setName] = useState('');
  const buyInCents = parseMoney(buyIn);
  const names = game.players.map((p) => p.name.toLowerCase());

  const addPlayer = () => {
    const trimmed = name.trim();
    if (!trimmed || names.includes(trimmed.toLowerCase())) return;
    setGame({
      ...game,
      players: [...game.players, { id: newId(), name: trimmed, buyIns: 1, finalCents: null }],
    });
    setName('');
  };

  const canStart = game.players.length >= 2 && buyInCents !== null && buyInCents > 0;

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
        {buyInCents === null && buyIn !== '' && <Text style={styles.error}>Ungültiger Betrag</Text>}
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
            onSubmitEditing={addPlayer}
            submitBehavior="submit"
            returnKeyType="done"
            autoCapitalize="words"
          />
          <Button label="+" onPress={addPlayer} style={{ marginLeft: 8, width: 52 }} />
        </View>
        {names.includes(name.trim().toLowerCase()) && (
          <Text style={styles.error}>Name ist schon vergeben</Text>
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
  const pot = totalPotCents(game);

  const changeBuyIns = (id: string, delta: number) =>
    setGame({
      ...game,
      players: game.players.map((p) =>
        p.id === id ? { ...p, buyIns: Math.max(1, p.buyIns + delta) } : p,
      ),
    });

  const addLatePlayer = () => {
    const trimmed = lateName.trim();
    if (!trimmed || game.players.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      return;
    }
    setGame({
      ...game,
      players: [...game.players, { id: newId(), name: trimmed, buyIns: 1, finalCents: null }],
    });
    setLateName('');
  };

  return (
    <Page title="Spiel läuft" subtitle={`Start-Geld: ${formatMoney(game.buyInCents, game.currency)}`}>
      <View style={styles.potBox}>
        <Text style={styles.potLabel}>Im Topf</Text>
        <Text style={styles.potValue}>{formatMoney(pot, game.currency)}</Text>
      </View>

      <Card>
        {game.players.map((p) => (
          <View key={p.id} style={styles.playerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.playerName}>{p.name}</Text>
              <Text style={styles.muted}>
                {p.buyIns}× eingekauft · {formatMoney(investedCents(p, game.buyInCents), game.currency)}
              </Text>
            </View>
            {p.buyIns > 1 && (
              <Button
                label="−"
                small
                secondary
                onPress={() =>
                  confirm('Rebuy zurücknehmen?', `Einen Einkauf von ${p.name} entfernen.`, () =>
                    changeBuyIns(p.id, -1),
                  )
                }
                style={{ marginRight: 8 }}
              />
            )}
            <Button label="+ Rebuy" small onPress={() => changeBuyIns(p.id, 1)} />
          </View>
        ))}
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
            onSubmitEditing={addLatePlayer}
            autoCapitalize="words"
          />
          <Button label="+" onPress={addLatePlayer} style={{ marginLeft: 8, width: 52 }} />
        </View>
      </Card>

      <Button label="Spiel beenden – Endstände eingeben" onPress={() => setGame({ ...game, phase: 'ending' })} big />
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

function EndingScreen({ game, setGame }: ScreenProps) {
  const [inputs, setInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      game.players.map((p) => [
        p.id,
        p.finalCents === null ? '' : formatMoney(p.finalCents, '').trim().replace(/\./g, ''),
      ]),
    ),
  );

  const setInput = (id: string, text: string) => {
    setInputs({ ...inputs, [id]: text });
    const cents = text.trim() === '' ? null : parseMoney(text);
    setGame({
      ...game,
      players: game.players.map((p) =>
        p.id === id ? { ...p, finalCents: cents !== null && cents >= 0 ? cents : null } : p,
      ),
    });
  };

  const pot = totalPotCents(game);
  const entered = totalFinalCents(game);
  const diff = entered - pot;
  const allEntered = game.players.every((p) => p.finalCents !== null);
  const invalid = game.players.filter((p) => {
    const t = inputs[p.id]?.trim() ?? '';
    return t !== '' && p.finalCents === null;
  });

  return (
    <Page title="Endstände" subtitle="Wie viel Geld/Chips hat jeder am Ende vor sich?">
      <Card>
        {game.players.map((p) => (
          <View key={p.id} style={styles.playerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.playerName}>{p.name}</Text>
              <Text style={styles.muted}>
                eingezahlt {formatMoney(investedCents(p, game.buyInCents), game.currency)}
              </Text>
            </View>
            <TextInput
              style={[
                styles.input,
                { width: 110, textAlign: 'right' },
                invalid.includes(p) && { borderColor: C.red },
              ]}
              value={inputs[p.id]}
              onChangeText={(t) => setInput(p.id, t)}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={C.muted}
            />
          </View>
        ))}
      </Card>

      <Card>
        <SummaryRow label="Im Topf (alle Einkäufe)" value={formatMoney(pot, game.currency)} />
        <SummaryRow label="Eingegebene Endstände" value={formatMoney(entered, game.currency)} />
        <SummaryRow
          label="Differenz"
          value={formatMoney(diff, game.currency, true)}
          color={diff === 0 ? C.green : C.red}
        />
        {diff !== 0 && allEntered && (
          <Text style={styles.error}>
            {diff > 0
              ? `Es wurde ${formatMoney(diff, game.currency)} zu viel eingetragen.`
              : `Es fehlen noch ${formatMoney(-diff, game.currency)}.`}{' '}
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
  const sorted = [...game.players].sort(
    (a, b) => netCents(b, game.buyInCents) - netCents(a, game.buyInCents),
  );

  const restartSamePlayers = () =>
    confirm('Neues Spiel?', 'Die aktuelle Abrechnung wird gelöscht.', () =>
      setGame({
      ...game,
      phase: 'setup',
      startedAt: null,
        players: game.players.map((p) => ({ ...p, id: newId(), buyIns: 1, finalCents: null })),
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
        {sorted.map((p) => {
          const net = netCents(p, game.buyInCents);
          return (
            <View key={p.id} style={styles.playerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.playerName}>{p.name}</Text>
                <Text style={styles.muted}>
                  {p.buyIns}× eingekauft ({formatMoney(investedCents(p, game.buyInCents), game.currency)}) · Ende{' '}
                  {formatMoney(p.finalCents ?? 0, game.currency)}
                </Text>
              </View>
              <Text
                style={[
                  styles.netValue,
                  { color: net > 0 ? C.green : net < 0 ? C.red : C.muted },
                ]}
              >
                {formatMoney(net, game.currency, true)}
              </Text>
            </View>
          );
        })}
      </Card>

      <Button label="Ergebnis teilen" big onPress={() => Share.share({ message: resultText(game) })} />
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
            setGame({ ...newGame(), buyInCents: game.buyInCents, currency: game.currency }),
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
});
