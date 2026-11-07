import React from 'react';
import { ScrollView, View } from 'react-native';
import { Chip, Field, T } from './ui';
import { space } from '../theme';
import { useCategories } from '../lib/hooks';
import { EXPIRING_TYPES } from '../lib/categories';
import { parseDate } from '../lib/classify';
import type { DocFields } from '../lib/documents';

export interface FormState {
  name: string;
  category: string;
  docType: string | null;
  expiry: string; // free text, validated
  fields: DocFields;
  notes: string;
}

export const expiryValid = (s: string) => !s.trim() || parseDate(s.trim()) != null;
export const normalizeExpiry = (s: string) => (s.trim() ? parseDate(s.trim()) : null);

export function DetailsForm({ value, onChange }: { value: FormState; onChange: (v: FormState) => void }) {
  const categories = useCategories();
  const cat = categories.find((c) => c.id === value.category);
  const set = (p: Partial<FormState>) => onChange({ ...value, ...p });
  const setField = (k: keyof DocFields, v: string) => set({ fields: { ...value.fields, [k]: v || undefined } });
  const showExpiry = !value.docType || EXPIRING_TYPES.has(value.docType) || !!value.expiry;

  return (
    <View style={{ gap: space.xl }}>
      <Field label="Name" value={value.name} onChangeText={(name) => set({ name })} placeholder="e.g. Passport" returnKeyType="done" />

      <View style={{ gap: space.sm }}>
        <T v="caption" color="muted">
          Category
        </T>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {categories.map((c) => (
            <Chip key={c.id} label={c.name} icon={c.icon as never} active={value.category === c.id} onPress={() => set({ category: c.id, docType: null })} />
          ))}
        </ScrollView>
      </View>

      {cat && cat.types.length > 0 && (
        <View style={{ gap: space.sm }}>
          <T v="caption" color="muted">
            Document type
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {cat.types.map((t) => (
              <Chip key={t} label={t} active={value.docType === t} onPress={() => set({ docType: value.docType === t ? null : t })} />
            ))}
          </View>
        </View>
      )}

      {showExpiry && (
        <Field
          label="Expiry date"
          value={value.expiry}
          onChangeText={(expiry) => set({ expiry })}
          placeholder="DD/MM/YYYY"
          keyboardType="numbers-and-punctuation"
          hint={expiryValid(value.expiry) ? 'We’ll remind you 90, 30 and 7 days before it expires.' : 'Enter a date like 12/06/2031'}
        />
      )}
      <Field label="Holder name" value={value.fields.holder ?? ''} onChangeText={(v) => setField('holder', v)} placeholder="As printed on the document" />
      <Field label="Document number" value={value.fields.number ?? ''} onChangeText={(v) => setField('number', v)} autoCapitalize="characters" autoCorrect={false} />
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <View style={{ flex: 1 }}>
          <Field label="Issued by" value={value.fields.issuer ?? ''} onChangeText={(v) => setField('issuer', v)} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Country" value={value.fields.country ?? ''} onChangeText={(v) => setField('country', v)} />
        </View>
      </View>
      <Field label="Notes" value={value.notes} onChangeText={(notes) => set({ notes })} multiline placeholder="Optional" />
    </View>
  );
}
