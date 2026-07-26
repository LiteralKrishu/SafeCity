import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Share, StyleSheet, Text, View } from 'react-native';

import { ChoiceSheet, type ChoiceItem } from '@/components/choice-sheet';
import { EscapeToolCard } from '@/components/escape-tool-card';
import { Screen } from '@/components/Screen';
import { useLocalization } from '@/i18n/localization-provider';
import { colors, radii, spacing, type } from '@/theme/tokens';

type VisibleSheet = 'location' | 'scripts' | null;

export default function EscapeToolsScreen() {
  const router = useRouter();
  const { t } = useLocalization();
  const [visibleSheet, setVisibleSheet] = useState<VisibleSheet>(null);

  const locations: ChoiceItem[] = [
    { id: 'home', label: t('escape.locationHome') },
    { id: 'office', label: t('escape.locationOffice') },
    { id: 'metro', label: t('escape.locationMetro') },
    { id: 'cafe', label: t('escape.locationCafe') },
  ];

  const scripts: ChoiceItem[] = [
    { id: 'call', label: t('escape.scriptOne') },
    { id: 'ride', label: t('escape.scriptTwo') },
    { id: 'home', label: t('escape.scriptThree') },
    { id: 'appointment', label: t('escape.scriptFour') },
  ];

  const shareLocationCover = async (item: ChoiceItem) => {
    setVisibleSheet(null);
    await Share.share({
      title: t('escape.shareTitle'),
      message: t('escape.locationMessage', { place: item.label }),
    });
  };

  const showScript = (item: ChoiceItem) => {
    setVisibleSheet(null);
    Alert.alert(t('escape.scriptsTitle'), item.label);
  };

  return (
    <>
      <Screen eyebrow={t('escape.eyebrow')} title={t('escape.title')}>
        <View style={styles.intro}>
          <View style={styles.introIcon}>
            <Text style={styles.introIconText}>↗</Text>
          </View>
          <Text style={styles.introTitle}>{t('escape.introTitle')}</Text>
          <Text style={styles.introBody}>{t('escape.introBody')}</Text>
        </View>

        <View style={styles.tools}>
          <EscapeToolCard
            icon="☎"
            title={t('escape.fakeCallTitle')}
            detail={t('escape.fakeCallDetail')}
            onPress={() => router.push('/fake-call' as Href)}
          />
          <EscapeToolCard
            icon="⌖"
            title={t('escape.locationTitle')}
            detail={t('escape.locationDetail')}
            onPress={() => setVisibleSheet('location')}
          />
          <EscapeToolCard
            icon="◷"
            title={t('escape.interruptionTitle')}
            detail={t('escape.interruptionDetail')}
            onPress={() => router.push('/timed-interruption' as Href)}
          />
          <EscapeToolCard
            icon="▰"
            title={t('escape.rideTitle')}
            detail={t('escape.rideDetail')}
            onPress={() => router.push('/cover-story' as Href)}
          />
          <EscapeToolCard
            icon="“”"
            title={t('escape.scriptsTitle')}
            detail={t('escape.scriptsDetail')}
            onPress={() => setVisibleSheet('scripts')}
          />
        </View>

        <View style={styles.safetyNote}>
          <Text style={styles.safetyNoteTitle}>{t('escape.safetyNoteTitle')}</Text>
          <Text style={styles.safetyNoteBody}>{t('escape.safetyNoteBody')}</Text>
        </View>
      </Screen>

      <ChoiceSheet
        visible={visibleSheet === 'location'}
        title={t('escape.chooseLocation')}
        note={t('escape.shareNote')}
        items={locations}
        onSelect={(item) => void shareLocationCover(item)}
        onClose={() => setVisibleSheet(null)}
      />
      <ChoiceSheet
        visible={visibleSheet === 'scripts'}
        title={t('escape.scriptsTitle')}
        items={scripts}
        onSelect={showScript}
        onClose={() => setVisibleSheet(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  intro: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.safeDark,
    backgroundColor: colors.safeSoft,
    padding: spacing.lg,
    alignItems: 'flex-start',
  },
  introIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.safe, alignItems: 'center', justifyContent: 'center' },
  introIconText: { color: colors.background, fontSize: 25, fontWeight: '900' },
  introTitle: { color: colors.text, fontSize: type.title, lineHeight: 30, fontWeight: '900', marginTop: spacing.md },
  introBody: { color: colors.textMuted, fontSize: type.body, lineHeight: 22, marginTop: spacing.sm },
  tools: { gap: spacing.sm, marginTop: spacing.md },
  safetyNote: { borderRadius: radii.md, borderWidth: 1, borderColor: colors.dangerBorder, backgroundColor: colors.dangerPanel, padding: spacing.md, marginTop: spacing.lg },
  safetyNoteTitle: { color: colors.danger, fontSize: type.body, fontWeight: '900' },
  safetyNoteBody: { color: colors.textMuted, fontSize: type.caption, lineHeight: 18, marginTop: 5 },
});
