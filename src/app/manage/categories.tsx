import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Field, Group, Row, T, Tap } from '../../components/ui';
import { BottomSheet } from '../../components/Sheet';
import { radius, space, useTheme } from '../../theme';
import { useCategories, useDocuments } from '../../lib/hooks';
import { addCustomCategory } from '../../lib/db';
import { uuid } from '../../lib/crypto';
import { notify, notifyError } from '../../lib/feedback';

const ICONS = ['folder-outline', 'home-outline', 'car-outline', 'school-outline', 'briefcase-outline', 'paw-outline', 'medkit-outline', 'receipt-outline'] as const;
const HUES: { hex: string; name: string }[] = [
  { hex: '#5B45F2', name: 'Violet' },
  { hex: '#E5484D', name: 'Red' },
  { hex: '#2F80ED', name: 'Blue' },
  { hex: '#15A06A', name: 'Green' },
  { hex: '#F2994A', name: 'Orange' },
  { hex: '#B04CE0', name: 'Purple' },
];

export default function Categories() {
  const { c } = useTheme();
  const cats = useCategories();
  const { docs } = useDocuments();
  const [adding, setAdding] = useState(false);

  return (
    <ScrollView contentContainerStyle={{ padding: space.xl, paddingTop: 0 }}>
      <Stack.Screen options={{ title: 'Categories' }} />
      <Group footer="Tap a category to see its documents.">
        {cats.map((cat) => {
          const n = docs.filter((d) => d.category === cat.id).length;
          return (
            <Row
              key={cat.id}
              icon={cat.icon as never}
              title={cat.name}
              subtitle={cat.custom ? 'Custom' : undefined}
              value={`${n} ${n === 1 ? 'document' : 'documents'}`}
              onPress={() => router.push({ pathname: '/(tabs)/documents', params: { category: cat.id } })}
            />
          );
        })}
      </Group>
      <Tap
        onPress={() => setAdding(true)}
        accessibilityLabel="New category"
        style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: space.sm, height: 44, paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: 1, borderStyle: 'dashed', borderColor: c.textFaint }}
      >
        <Ionicons name="add" size={18} color={c.textMuted} />
        <T v="callout">New category</T>
        <T v="caption" color="muted">
          e.g. Vehicle, Pets
        </T>
      </Tap>
      <CategoryEditor visible={adding} onClose={() => setAdding(false)} />
    </ScrollView>
  );
}

function CategoryEditor({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { c } = useTheme();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string>(ICONS[0]);
  const [hue, setHue] = useState(HUES[0].hex);

  const save = async () => {
    const n = name.trim();
    if (!n) return;
    try {
      await addCustomCategory({ id: `c_${uuid().slice(0, 8)}`, name: n, icon, hue });
      notify(`Category “${n}” added`);
      setName('');
      onClose();
    } catch (e) {
      notifyError(e, 'Couldn’t add the category', { retry: save });
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="New category" action={{ label: 'Create', onPress: save, disabled: !name.trim() }}>
      <View style={{ paddingHorizontal: space.xl, gap: space.lg, paddingBottom: space.lg }}>
        <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Vehicle" autoFocus returnKeyType="done" onSubmitEditing={save} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {ICONS.map((i) => (
            <Tap
              key={i}
              onPress={() => setIcon(i)}
              accessibilityLabel={`Icon ${i.replace('-outline', '')}`}
              accessibilityState={{ selected: icon === i }}
              style={{ width: 48, height: 48, borderRadius: radius.md, backgroundColor: icon === i ? hue + '22' : c.surface, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name={i} size={22} color={icon === i ? hue : c.textMuted} />
            </Tap>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          {HUES.map((h) => (
            <Tap
              key={h.hex}
              onPress={() => setHue(h.hex)}
              accessibilityLabel={h.name}
              accessibilityState={{ selected: hue === h.hex }}
              style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: h.hex, borderWidth: hue === h.hex ? 3 : 0, borderColor: c.text }}
            >
              <View />
            </Tap>
          ))}
        </View>
      </View>
    </BottomSheet>
  );
}
