import React from 'react';
import { View } from 'react-native';
import { EmptyState } from './ui';
import { SkeletonRows } from './motion';
import { friendlyError } from '../lib/feedback';
import { space } from '../theme';

/**
 * What a list shows when it has nothing to render yet: placeholders while loading, a readable
 * error with Try again if loading failed, otherwise the screen's own empty state.
 * Use it as a FlatList's ListEmptyComponent, or in place of content while `items.length === 0`.
 */
export function ListState({
  loading,
  error,
  onRetry,
  empty,
  skeleton,
}: {
  loading: boolean;
  error?: unknown;
  onRetry?: () => void;
  empty: React.ReactNode;
  skeleton?: React.ReactNode;
}) {
  if (loading) return <>{skeleton ?? <View style={{ paddingHorizontal: space.xl }}><SkeletonRows count={4} /></View>}</>;
  if (error)
    return (
      <EmptyState
        icon="cloud-offline-outline"
        title="Couldn’t load this"
        body={friendlyError(error) ?? 'Please try again.'}
        action={onRetry ? 'Try again' : undefined}
        onAction={onRetry}
      />
    );
  return <>{empty}</>;
}
