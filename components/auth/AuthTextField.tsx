import React, { forwardRef } from 'react';
import { StyleSheet, TextInput as RNTextInput } from 'react-native';
import { TextInput, type TextInputProps } from 'react-native-paper';
import { AUTH } from '../../constants/theme';

/**
 * Outlined Paper inputs need a solid `background` theme color so the floating
 * label punches a clean gap in the border. Semi-transparent field fills make
 * "Email" look crossed out by the outline.
 */
export const AuthTextField = forwardRef<RNTextInput, TextInputProps>(function AuthTextField(
  { style, ...props },
  ref,
) {
  return (
    <TextInput
      ref={ref}
      mode="outlined"
      textColor={AUTH.cream}
      outlineColor={AUTH.panelBorder}
      activeOutlineColor={AUTH.teal}
      selectionColor={AUTH.tealSoft}
      cursorColor={AUTH.teal}
      placeholderTextColor={AUTH.mistBright}
      {...props}
      style={[styles.field, style]}
      theme={{
        roundness: 14,
        colors: {
          primary: AUTH.teal,
          onSurfaceVariant: AUTH.mistBright,
          background: AUTH.fieldSolid,
        },
      }}
    />
  );
});

const styles = StyleSheet.create({
  field: {
    marginBottom: 12,
    backgroundColor: AUTH.fieldSolid,
  },
});
