import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
      setError('تعذر تسجيل الدخول — تأكد من رقم الهاتف');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="grid size-12 place-items-center rounded-xl bg-primary text-2xl font-extrabold text-primary-foreground">
            ه
          </span>
          <h1 className="text-2xl font-bold text-foreground">هايبر — لوحة التحكم</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>تسجيل دخول الموظفين</CardTitle>
            <CardDescription>أدخل رقم هاتف الموظف للدخول إلى لوحة التحكم.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor="phone">رقم الهاتف</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  dir="ltr"
                  className="text-start"
                  aria-label="phone"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" variant="cta" disabled={busy} className="w-full">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
                دخول
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
