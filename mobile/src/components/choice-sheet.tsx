import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLocalization } from '@/i18n/localization-provider';
import { colors, radii, spacing, type } from '@/theme/tokens';

export interface ChoiceItem {
  id: string;
  label: string;
  detail?: string;
}

export function ChoiceSheet({
  visible,
  title,
  note,
  items,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  note?: string;
  items: ChoiceItem[];
  onSelect: (item: ChoiceItem) => void;
  onClose: () => void;
}) {
  const { t } = useLocalization();
  return (
    <Modal transparent visible={visible} onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom', 'left', 'right']}>
        <Pressable accessibilityLabel={t('common.close')} onPress={onClose} style={styles.backdrop} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>
          {note ? <Text style={styles.note}>{note}</Text> : null}
          <View style={styles.items}>
            {items.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                onPress={() => onSelect(item)}
                style={({ pressed }) => [styles.item, pressed && styles.pressed]}
              >
                <View style={styles.itemCopy}>
                  <Text style={styles.itemLabel}>{item.label}</Text>
                  {item.detail ? <Text style={styles.itemDetail}>{item.detail}</Text> : null}
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0, 0, 0, 0.72)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  handle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: colors.border },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  title: { flex: 1, color: colors.text, fontSize: type.title, fontWeight: '900' },
  closeButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: colors.textMuted, fontSize: 26, lineHeight: 29 },
  note: { color: colors.textMuted, fontSize: type.caption, lineHeight: 18 },
  items: { gap: spacing.sm },
  item: { minHeight: 60, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceRaised, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pressed: { opacity: 0.7 },
  itemCopy: { flex: 1 },
  itemLabel: { color: colors.text, fontSize: type.body, fontWeight: '800' },
  itemDetail: { color: colors.textMuted, fontSize: type.caption, marginTop: 3 },
  chevron: { color: colors.safe, fontSize: 26 },
});
