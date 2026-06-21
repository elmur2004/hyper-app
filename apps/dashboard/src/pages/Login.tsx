import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card } from '@hyper/shared/ui';
import { api } from '../api';
import { useAuth } from '../auth';

export function LoginPage() {
  const [phone, setPhone] = useState('+201111111100'); // seed HQ admin
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { setToken } = useAuth();
  const navigate = useNavigate();

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const { token } = await api.auth.staffLogin(phone);
      setToken(token);
      navigate('/orders');
    } catch {
      setError('تعذر تسجيل الدخول');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '64px auto' }}>
      <Card header="تسجيل دخول الموظفين">
        <label style={{ display: 'block', marginBottom: 8 }}>رقم الهاتف</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={{ width: '100%', padding: 8, marginBottom: 12 }}
          aria-label="phone"
        />
        {error && <p style={{ color: '#D11149' }}>{error}</p>}
        <Button onClick={submit} loading={busy}>
          دخول
        </Button>
      </Card>
    </div>
  );
}
