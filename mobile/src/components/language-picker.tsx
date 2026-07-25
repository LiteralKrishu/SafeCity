import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLocalization } from '@/i18n/localization-provider';
import {
  getLanguageDisplayName,
  supportedLanguages,
  type LanguagePreference,
  type SupportedLanguage,
} from '@/i18n/types';
import { colors, radii, spacing, type } from '@/theme/tokens';

export function LanguagePicker({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const {
    language,
    preference,
    preparingLanguage,
    setLanguagePreference,
    t,
  } = useLocalization();
  const [query, setQuery] = useState('');
  const [choosing, setChoosing] = useState<LanguagePreference | null>(null);

  const options = useMemo(
    () =>
      supportedLanguages
        .map((option) => {
          const nativeName = getLanguageDisplayName(option.code, option.code);
          const localizedName = getLanguageDisplayName(option.code, language);
          return {
            ...option,
            nativeName,
            localizedName,
            label:
              nativeName.toLocaleLowerCase() === localizedName.toLocaleLowerCase()
                ? nativeName
                : `${nativeName} · ${localizedName}`,
          };
        })
        .filter((option) => {
          const normalizedQuery = query.trim().toLocaleLowerCase();
          if (!normalizedQuery) return true;
          return `${option.code} ${option.label} ${option.localizedName}`
            .toLocaleLowerCase()
            .includes(normalizedQuery);
        }),
    [language, query],
  );

  const choose = async (next: LanguagePreference) => {
    if (next === preference) {
      setQuery('');
      onClose();
      return;
    }
    const displayName =
      next === 'system' ? t('language.system') : getLanguageDisplayName(next, next);
    setChoosing(next);
    try {
      await setLanguagePreference(next);
      setQuery('');
      onClose();
    } catch {
      Alert.alert(
        t('language.unavailableTitle'),
        t('language.unavailableBody', { language: displayName }),
      );
    } finally {
      setChoosing(null);
    }
  };

  const renderOption = ({
    code,
    label,
    detail,
  }: {
    code: LanguagePreference;
    label: string;
    detail?: string;
  }) => {
    const selected = preference === code;
    const loading = choosing === code || preparingLanguage === code;
    return (
      <Pressable
        key={code}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected, disabled: choosing !== null }}
        disabled={choosing !== null}
        onPress={() => void choose(code)}
        style={({ pressed }) => [
          styles.option,
          selected && styles.optionSelected,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.optionCopy}>
          <Text style={styles.optionLabel}>{label}</Text>
          {detail ? <Text style={styles.optionDetail}>{detail}</Text> : null}
        </View>
        {loading ? (
          <ActivityIndicator color={colors.safe} />
        ) : (
          <View style={[styles.radio, selected && styles.radioSelected]}>
            {selected ? <View style={styles.radioCore} /> : null}
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <Modal transparent visible={visible} onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom', 'left', 'right']}>
        <Pressable accessibilityLabel={t('common.close')} onPress={onClose} style={styles.backdrop} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.title}>{t('language.title')}</Text>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          {renderOption({
            code: 'system',
            label: t('language.system'),
            detail: t('language.systemDetail'),
          })}

          <TextInput
            accessibilityLabel={t('language.search')}
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setQuery}
            placeholder={t('language.search')}
            placeholderTextColor={colors.textMuted}
            style={styles.search}
            value={query}
          />

          <ScrollView
            contentContainerStyle={styles.optionList}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {options.map((option) =>
              renderOption({ code: option.code, label: option.label }),
            )}
          </ScrollView>

          <Text style={styles.privacyNote}>{t('language.onDevice')}</Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0, 0, 0, 0.72)' },
  sheet: {
    maxHeight: '92%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  handle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: colors.border },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.text, fontSize: type.title, fontWeight: '900' },
  closeButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: colors.textMuted, fontSize: 26, lineHeight: 29 },
  search: {
    minHeight: 50,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    color: colors.text,
    fontSize: type.body,
    paddingHorizontal: spacing.md,
  },
  optionList: { gap: spacing.sm, paddingBottom: spacing.xs },
  option: {
    minHeight: 62,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  optionSelected: { borderColor: colors.safe, backgroundColor: colors.safeSoft },
  pressed: { opacity: 0.76 },
  optionCopy: { flex: 1 },
  optionLabel: { color: colors.text, fontSize: type.body, fontWeight: '800' },
  optionDetail: { color: colors.textMuted, fontSize: type.caption, lineHeight: 18, marginTop: 3 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.textMuted, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: colors.safe },
  radioCore: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.safe },
  privacyNote: { color: colors.textMuted, fontSize: type.caption, lineHeight: 18 },
});
