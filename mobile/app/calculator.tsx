import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme/tokens';

type Operator = '÷' | '×' | '−' | '+';

const keys: Array<string> = ['C', '±', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '0', '.', '='];

function calculate(left: number, right: number, operator: Operator): number {
  if (operator === '+') return left + right;
  if (operator === '−') return left - right;
  if (operator === '×') return left * right;
  return right === 0 ? Number.NaN : left / right;
}

function formatResult(value: number): string {
  if (!Number.isFinite(value)) return 'Error';
  return Number.parseFloat(value.toPrecision(12)).toString();
}

export default function CalculatorScreen() {
  const router = useRouter();
  const [display, setDisplay] = useState('0');
  const [accumulator, setAccumulator] = useState<number | null>(null);
  const [operator, setOperator] = useState<Operator | null>(null);
  const [awaitingOperand, setAwaitingOperand] = useState(false);

  const clear = () => {
    setDisplay('0');
    setAccumulator(null);
    setOperator(null);
    setAwaitingOperand(false);
  };

  const pressDigit = (digit: string) => {
    if (display === 'Error' || awaitingOperand) {
      setDisplay(digit);
      setAwaitingOperand(false);
      return;
    }
    setDisplay((current) => (current === '0' ? digit : `${current}${digit}`).slice(0, 14));
  };

  const pressDecimal = () => {
    if (display === 'Error' || awaitingOperand) {
      setDisplay('0.');
      setAwaitingOperand(false);
      return;
    }
    if (!display.includes('.')) setDisplay((current) => `${current}.`);
  };

  const pressOperator = (nextOperator: Operator) => {
    const current = Number(display);
    if (!Number.isFinite(current)) {
      clear();
      return;
    }
    if (accumulator !== null && operator && !awaitingOperand) {
      const result = calculate(accumulator, current, operator);
      const formatted = formatResult(result);
      setDisplay(formatted);
      setAccumulator(Number.isFinite(result) ? result : null);
    } else {
      setAccumulator(current);
    }
    setOperator(nextOperator);
    setAwaitingOperand(true);
  };

  const equals = () => {
    if (accumulator === null || !operator || display === 'Error') return;
    const result = calculate(accumulator, Number(display), operator);
    setDisplay(formatResult(result));
    setAccumulator(null);
    setOperator(null);
    setAwaitingOperand(true);
  };

  const pressKey = (key: string) => {
    if (/^\d$/u.test(key)) return pressDigit(key);
    if (key === '.') return pressDecimal();
    if (key === 'C') return clear();
    if (key === '±') {
      if (display !== '0' && display !== 'Error') setDisplay(formatResult(Number(display) * -1));
      return;
    }
    if (key === '%') {
      if (display !== 'Error') setDisplay(formatResult(Number(display) / 100));
      return;
    }
    if (key === '=') return equals();
    pressOperator(key as Operator);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>Calculator</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Close calculator" onPress={() => router.back()} style={styles.close}>
          <Text style={styles.closeText}>Done</Text>
        </Pressable>
      </View>

      <View style={styles.display}>
        <Text adjustsFontSizeToFit numberOfLines={1} style={styles.displayText}>{display}</Text>
      </View>

      <View style={styles.keypad}>
        {keys.map((key) => {
          const isOperator = ['÷', '×', '−', '+', '='].includes(key);
          const isUtility = ['C', '±', '%'].includes(key);
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={key}
              onPress={() => pressKey(key)}
              style={({ pressed }) => [
                styles.key,
                key === '0' && styles.zeroKey,
                isOperator && styles.operatorKey,
                isUtility && styles.utilityKey,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.keyText, isUtility && styles.utilityText]}>{key}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#050505', paddingHorizontal: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 56 },
  title: { color: '#F3F4F6', fontSize: 18, fontWeight: '700' },
  close: { minWidth: 58, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
  closeText: { color: '#AEB4BE', fontSize: 15, fontWeight: '600' },
  display: { flex: 1, alignItems: 'flex-end', justifyContent: 'flex-end', paddingHorizontal: spacing.sm, paddingBottom: spacing.lg },
  displayText: { color: '#FFFFFF', fontSize: 72, lineHeight: 82, fontWeight: '300', fontVariant: ['tabular-nums'] },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, paddingBottom: spacing.lg },
  key: { width: '21.5%', aspectRatio: 1, borderRadius: 999, backgroundColor: '#2C2C2E', alignItems: 'center', justifyContent: 'center' },
  zeroKey: { width: '47%', aspectRatio: 2.15, alignItems: 'flex-start', paddingLeft: 29 },
  operatorKey: { backgroundColor: '#F29A20' },
  utilityKey: { backgroundColor: '#A7A7AA' },
  keyText: { color: '#FFFFFF', fontSize: 30, fontWeight: '500' },
  utilityText: { color: '#111111' },
  pressed: { opacity: 0.62, transform: [{ scale: 0.96 }] },
});
