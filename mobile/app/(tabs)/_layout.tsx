import { Tabs } from 'expo-router';
import { type ColorValue, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/tokens';
import { useLocalization } from '@/i18n/localization-provider';

type TabIconName = 'shield' | 'logs' | 'contacts';

function TabIcon({ name, color }: { name: TabIconName; color: ColorValue }) {
  if (name === 'logs') {
    return (
      <View style={[styles.calendarIcon, { borderColor: color }]}>
        <View style={[styles.calendarBar, { backgroundColor: color }]} />
        <View style={[styles.calendarLine, { backgroundColor: color }]} />
      </View>
    );
  }

  return (
    <Text style={[styles.symbolIcon, { color }]}>{name === 'shield' ? '♢' : '⚙'}</Text>
  );
}

export default function TabLayout() {
  const { t } = useLocalization();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.safe,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarHideOnKeyboard: true,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabItem,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarAccessibilityLabel: t('tabs.home'),
          tabBarIcon: ({ color }) => <TabIcon name="shield" color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: t('tabs.logs'),
          tabBarAccessibilityLabel: t('tabs.logs'),
          tabBarIcon: ({ color }) => <TabIcon name="logs" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.contacts'),
          tabBarAccessibilityLabel: t('tabs.contacts'),
          tabBarIcon: ({ color }) => <TabIcon name="contacts" color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.navigation,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: 78,
    paddingTop: 9,
    paddingBottom: 9,
  },
  tabItem: { gap: 3 },
  tabLabel: { fontSize: 11, fontWeight: '800' },
  symbolIcon: { fontSize: 31, lineHeight: 32, fontWeight: '500' },
  calendarIcon: { width: 28, height: 27, borderWidth: 2.5, borderRadius: 5, marginTop: 2, paddingTop: 7, alignItems: 'center' },
  calendarBar: { position: 'absolute', top: 5, left: -2.5, right: -2.5, height: 2.5 },
  calendarLine: { width: 13, height: 2, borderRadius: 1, marginTop: 4 },
});
