import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { FadeInDown } from '../theme/anim';
import { Backdrop } from '../components/Backdrop';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, IconButton, T, Tap } from '../components/ui';
import { CountdownRing } from '../components/CountdownRing';
import { DocThumb } from '../components/docs';
import { radius, space, useTheme } from '../theme';
import { useDocuments, usePrefs } from '../lib/hooks';
import { daysUntil, formatDate } from '../lib/format';
import { setPrefs } from '../lib/session';
import { DUR, EASE_OUT } from '../theme/motion';

const GROUPS = [
  { key: 'expired', title: 'Expired', test: (d: number) => d < 0 },
  { key: 'soon', title: 'Within 30 days', test: (d: number) => d >= 0 && d <= 30 },
  { key: 'quarter', title: 'Within 90 days', test: (d: number) => d > 30 && d <= 90 },
  { key: 'later', title: 'Later', test: (d: number) => d > 90 },
];

/** Renewal timeline: every document with an expiry date, grouped by urgency. */
export default function Renewals() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { docs } = useDocuments();
  const prefs = usePrefs();
  const dated = useMemo(
    () => docs.map((d) => ({ d, days: daysUntil(d.expiry)! })).filter((x) => x.d.expiry).sort((a, b) => a.days - b.days),
    [docs],
  );
  const urgent = dated.filter((x) => x.days <= 30).length;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <Backdrop variant="list" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xxxl }}>
        <View style={{ paddingHorizontal: space.xl, paddingTop: space.sm }}>
          <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} size={40} />
          <T v="title" style={{ marginTop: space.lg }}>
            Renewals
          </T>
          <T v="callout" color="muted" style={{ marginTop: 4 }}>
            {dated.length === 0 ? 'Add expiry dates to get reminded in time.' : urgent ? `${urgent} ${urgent === 1 ? 'document needs' : 'documents need'} attention soon.` : 'Everything is up to date.'}
          </T>
        </View>

        <View style={{ marginHorizontal: space.xl, marginTop: space.xl, flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: c.surface, borderRadius: radius.lg, padding: space.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline }}>
          <Ionicons name="notifications-outline" size={22} color={c.gold} />
          <View style={{ flex: 1 }}>
            <T v="bodyStrong">Expiry reminders</T>
            <T v="caption" color="muted">
              90, 30 and 7 days before
            </T>
          </View>
          <Switch value={prefs.expiryReminders} onValueChange={(v) => setPrefs({ expiryReminders: v })} trackColor={{ true: c.gold }} />
        </View>

        {dated.length === 0 ? (
          <EmptyState icon="calendar-outline" title="No expiry dates yet" body="Open a passport, visa or insurance document and add its expiry date." />
        ) : (
          GROUPS.map((g) => {
            const items = dated.filter((x) => g.test(x.days));
            if (!items.length) return null;
            return (
              <View key={g.key} style={{ marginTop: space.xxl, paddingHorizontal: space.xl }}>
                <T v="overline" color={g.key === 'expired' ? c.danger : g.key === 'soon' ? c.warning : 'muted'} style={{ marginBottom: space.sm }}>
                  {g.title.toUpperCase()} · {items.length}
                </T>
                {/* timeline */}
                <View style={{ borderLeftWidth: 1, borderLeftColor: c.hairline, marginLeft: 23, paddingLeft: 0 }}>
                  {items.map(({ d, days }, i) => (
                    <Animated.View key={d.id} entering={FadeInDown.delay(i * 40).duration(DUR.slow).easing(EASE_OUT)}>
                      <Tap onPress={() => router.push(`/doc/${d.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginLeft: -23, paddingVertical: space.sm }}>
                        <CountdownRing days={days} size={46} />
                        <View style={{ flex: 1, backgroundColor: c.surface, borderRadius: radius.md, padding: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline }}>
                          <DocThumb doc={d} size={36} />
                          <View style={{ flex: 1 }}>
                            <T v="bodyStrong" numberOfLines={1}>
                              {d.name}
                            </T>
                            <T v="caption" color="muted">
                              {days < 0 ? `Expired ${formatDate(d.expiry)}` : days === 0 ? 'Expires today' : `${formatDate(d.expiry)} · in ${days} days`}
                            </T>
                          </View>
                          <Ionicons name="chevron-forward" size={16} color={c.textFaint} />
                        </View>
                      </Tap>
                    </Animated.View>
                  ))}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
