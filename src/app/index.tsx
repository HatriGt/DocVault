import { Redirect } from 'expo-router';
import { useAccount } from '../lib/hooks';
import { useEffect, useState } from 'react';
import { hasLocalVaultKey } from '../lib/keys';

export default function Entry() {
  const { account, loading } = useAccount();
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  useEffect(() => {
    hasLocalVaultKey().then(setHasKey);
  }, []);
  if (loading || hasKey == null) return null;
  if (!account || !hasKey) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)" />;
}
