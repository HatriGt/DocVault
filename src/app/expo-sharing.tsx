import { Redirect } from 'expo-router';

/** expo-sharing opens the app at <scheme>://expo-sharing when a file is shared into DocVault. */
export default function ExpoSharingEntry() {
  return <Redirect href="/share" />;
}
