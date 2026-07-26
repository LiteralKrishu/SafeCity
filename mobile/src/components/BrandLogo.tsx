import { Image, StyleSheet, View } from 'react-native';

export function BrandLogo({
  size = 56,
  accessibilityLabel = 'SafeCity logo',
}: {
  size?: number;
  accessibilityLabel?: string;
}) {
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image"
      style={{ width: size, height: size }}
    >
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        source={require('../../assets/safecity-logo.png')}
        style={styles.image}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
  },
});
