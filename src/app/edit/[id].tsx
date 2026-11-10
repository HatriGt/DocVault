import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { KeyboardSpacer } from '../../components/KeyboardSpacer';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Screen } from '../../components/ui';
import { ScreenHeader } from '../../components/ScreenHeader';
import { DetailsForm, expiryValid, FormState, normalizeExpiry } from '../../components/DetailsForm';
import { space } from '../../theme';
import { useDocument } from '../../lib/hooks';
import { parseFields, parseTags, updateDetails } from '../../lib/documents';
import type { DocRecord } from '../../lib/db';
import { moveDocument } from '../../lib/folders';

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
    tags: parseTags(doc),
    folderId: doc.folder_id,
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
      tags: form.tags,
    });
    if ((form.folderId ?? null) !== doc.folder_id) await moveDocument(doc.id, form.folderId ?? null);
    setSaving(false);
    router.back();
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader variant="modal" leading="close" title="Edit details" />
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: space.xl }} keyboardShouldPersistTaps="handled">
          <DetailsForm value={form} onChange={setForm} />
        </ScrollView>
        <View style={{ padding: space.xl, paddingTop: space.sm }}>
          <Button title="Save changes" onPress={save} loading={saving} disabled={!form.name.trim() || !expiryValid(form.expiry)} />
        </View>
        <KeyboardSpacer />
      </View>
    </Screen>
  );
}
