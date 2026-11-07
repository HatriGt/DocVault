import React from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { FolderPicker } from '../../components/Folders';
import { useDocument } from '../../lib/hooks';
import { moveDocument } from '../../lib/folders';

/** Transparent route that hosts the folder picker for "Move to folder". */
export default function MoveDocument() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { doc } = useDocument(id);
  return (
    <View style={{ flex: 1 }}>
      {doc && (
        <FolderPicker
          visible
          value={doc.folder_id}
          title={`Move “${doc.name}”`}
          action="Move here"
          onClose={() => router.back()}
          onPick={async (dest) => {
            await moveDocument(doc.id, dest);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          }}
        />
      )}
    </View>
  );
}
