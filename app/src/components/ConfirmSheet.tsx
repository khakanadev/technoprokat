// Подтверждение необратимого действия (ПИ-05)
import { useState } from 'react';
import { Text } from 'react-native';
import { type } from '../lib/theme';
import { Sheet } from './Sheet';
import { Banner, Button } from './ui';

export function ConfirmSheet({
  visible, title, text, confirm, danger, onClose, onConfirm,
}: {
  visible: boolean; title: string; text: string; confirm: string; danger?: boolean;
  onClose: () => void; onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      visible={visible} onClose={onClose} title={title}
      footer={<>
        {error ? <Banner text={error} /> : null}
        <Button title={confirm} variant={danger ? 'danger' : 'primary'} onPress={run} loading={busy} />
        <Button title="Не сейчас" variant="ghost" onPress={onClose} />
      </>}
    >
      <Text style={type.body}>{text}</Text>
    </Sheet>
  );
}
