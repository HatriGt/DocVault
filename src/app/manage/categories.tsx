import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Field, Group, Row, T, Tap } from '../../components/ui';
import { radius, space, useTheme } from '../../theme';
import { useCategories, useDocuments } from '../../lib/hooks';
import { addCustomCategory } from '../../lib/db';
import { uuid } from '../../lib/crypto';

const ICONS = ['folder-outline', 'home-outline', 'car-outline', 'school-outline', 'briefcase-outline', 'paw-outline', 'medkit-outline', 'receipt-outline'] as const;
const HUES = ['#5B45F2', '#E5484D', '#2F80ED', '#15A06A', '#F2994A', '#B04CE0'];

export default function Categories() {
  const { c } = useTheme();
  const cats = useCategories();
  const { docs } = useDocuments();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string>(ICONS[0]);
  const [hue, setHue] = useState(HUES[0]);

  const add = async () => {
    await addCustomCategory({ id: `c_${uuid().slice(0, 8)}`, name: name.trim(), icon, hue });
    setName('');
  };

  return (
    <ScrollView contentContainerStyle={{ padding: space.xl }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Categories' }} />
      <Group>
        {cats.map((cat) => (
          <Row key={cat.id} icon={cat.icon as never} title={cat.name} subtitle={cat.custom ? 'Custom' : undefined} value={String(docs.filter((d) => d.category === cat.id).length)} />
        ))}
      </Group>
      <T v="heading" style={{ marginBottom: space.lg }}>
        New category
      </T>
      <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Vehicle" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.lg }}>
        {ICONS.map((i) => (
          <Tap key={i} onPress={() => setIcon(i)} style={{ width: 48, height: 48, borderRadius: radius.md, backgroundColor: icon === i ? hue + '22' : c.surface, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={i} size={22} color={icon === i ? hue : c.textMuted} />
          </Tap>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.lg }}>
        {HUES.map((h) => (
          <Tap key={h} onPress={() => setHue(h)} accessibilityLabel={`Colour ${h}`} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: h, borderWidth: hue === h ? 3 : 0, borderColor: c.text }}>
            <View />
          </Tap>
        ))}
      </View>
      <Button title="Add category" onPress={add} disabled={!name.trim()} style={{ marginTop: space.xl }} />
    </ScrollView>
  );
}
