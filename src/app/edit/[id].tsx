import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, IconButton, Screen, T } from '../../components/ui';
import { DetailsForm, expiryValid, FormState, normalizeExpiry } from '../../components/DetailsForm';
import { space } from '../../theme';
import { useDocument } from '../../lib/hooks';
import { parseFields, updateDetails } from '../../lib/documents';
import type { DocRecord } from '../../lib/db';

export default function EditDocument() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { doc } = useDocument(id);
  if (!doc) return <Screen>{null}</Screen>;
  return <EditForm doc={doc} />;
}

function EditForm({ doc }: { doc: DocRecord }) {
  const [form, setForm] = useState<FormState>(() => ({
    name: doc.name,
    category: doc.category,
    docType: doc.doc_type,
    expiry: doc.expiry ? doc.expiry.split('-').reverse().join('/') : '',
    fields: parseFields(doc),
    notes: doc.notes ?? '',
  }));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await updateDetails(doc.id, {
      name: form.name.trim(),
      category: form.category,
      doc_type: form.docType,
      expiry: normalizeExpiry(form.expiry),
      notes: form.notes.trim() || null,
      fields: form.fields,
    });
    setSaving(false);
    router.back();
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xl, height: 56 }}>
        <IconButton icon="close" label="Cancel" onPress={() => router.back()} />
        <T v="bodyStrong">Edit details</T>
        <View style={{ width: 44 }} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: space.xl }} keyboardShouldPersistTaps="handled">
          <DetailsForm value={form} onChange={setForm} />
        </ScrollView>
        <View style={{ padding: space.xl, paddingTop: space.sm }}>
          <Button title="Save changes" onPress={save} loading={saving} disabled={!form.name.trim() || !expiryValid(form.expiry)} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
