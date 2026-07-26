import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Divider, IconButton, Menu, useTheme } from 'react-native-paper';
import type { GoalStatus } from '../types';
import { AppCard } from './AppCard';

interface Props {
  status: GoalStatus;
  title: string;
  children: React.ReactNode;
  onEdit: () => void;
  onPause: () => void;
  onResume: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

export function EntityCard({
  status,
  title,
  children,
  onEdit,
  onPause,
  onResume,
  onArchive,
  onDelete,
}: Props) {
  const theme = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  function run(action: () => void) {
    setMenuOpen(false);
    action();
  }

  return (
    <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel={`Edit ${title}`}>
      <AppCard>
        <View style={styles.row}>
          <View style={styles.body}>{children}</View>
          <Menu
            visible={menuOpen}
            onDismiss={() => setMenuOpen(false)}
            anchor={
              <IconButton
                icon="dots-vertical"
                onPress={() => setMenuOpen(true)}
                accessibilityLabel={`${title} actions`}
              />
            }
          >
            {status === 'active' ? (
              <Menu.Item onPress={() => run(onPause)} title="Pause" leadingIcon="pause" />
            ) : (
              <Menu.Item onPress={() => run(onResume)} title="Resume" leadingIcon="play" />
            )}
            {status !== 'archived' ? (
              <Menu.Item onPress={() => run(onArchive)} title="Archive" leadingIcon="archive" />
            ) : null}
            <Divider />
            <Menu.Item
              onPress={() => run(onDelete)}
              title="Delete"
              leadingIcon="delete"
              titleStyle={{ color: theme.colors.error }}
            />
          </Menu>
        </View>
      </AppCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  body: {
    flex: 1,
    paddingRight: 4,
  },
});
