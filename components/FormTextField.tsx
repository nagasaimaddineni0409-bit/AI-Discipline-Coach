import React from 'react';
import { StyleSheet } from 'react-native';
import { TextInput, useTheme } from 'react-native-paper';

type Props = React.ComponentProps<typeof TextInput>;

/** Outlined text field with the same 14px radius used by time/date triggers. */
export function FormTextField({ style, ...props }: Props) {
  const theme = useTheme();
  return (
    <TextInput
      mode="outlined"
      {...props}
      outlineStyle={[styles.outline, props.outlineStyle]}
      style={[styles.field, style]}
      theme={{
        ...theme,
        roundness: 14,
        colors: {
          ...theme.colors,
          background: theme.colors.elevation?.level1 ?? theme.colors.surface,
        },
      }}
    />
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 4,
  },
  outline: {
    borderRadius: 14,
  },
});
