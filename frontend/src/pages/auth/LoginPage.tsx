import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { login as loginRequest } from '../../api/endpoints/auth';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../store/authStore';
import type { AuthUser } from '../../types';

interface LoginFormValues {
  email: string;
  password: string;
  tenantId?: string;
}

export function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const { register, handleSubmit } = useForm<LoginFormValues>();

  const onSubmit = handleSubmit(async (values) => {
    const response = await loginRequest(values);
    const payload = response.data as { success: boolean; data: { accessToken: string; user: AuthUser } };
    setSession(payload.data.user, payload.data.accessToken);
    navigate('/dashboard');
  });

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Sign In</h1>
      <form className="space-y-3" onSubmit={onSubmit}>
        <input className="w-full rounded border px-3 py-2" placeholder="Email" {...register('email')} />
        <input className="w-full rounded border px-3 py-2" type="password" placeholder="Password" {...register('password')} />
        <input className="w-full rounded border px-3 py-2" placeholder="Tenant ID (optional)" {...register('tenantId')} />
        <Button type="submit">Login</Button>
      </form>
    </div>
  );
}
