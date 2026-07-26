import { useTheme } from 'react-native-paper';
import { BrandPalette, DARK_PALETTE, LIGHT_PALETTE } from '../constants/theme';

/** Brand surface colors that follow the active light/dark Paper theme. */
export function useBrandPalette(): BrandPalette {
  const theme = useTheme();
  return theme.dark ? DARK_PALETTE : LIGHT_PALETTE;
}
