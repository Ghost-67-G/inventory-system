import { useForm } from 'react-hook-form';
import api from '../../api/client';
import { Button } from '../../components/ui/Button';

interface ForgotPasswordFormValues {
  email: string;
}

export function ForgotPasswordPage() {
  const { register, handleSubmit } = useForm<ForgotPasswordFormValues>();

  const onSubmit = handleSubmit(async (values) => {
    await api.post('/auth/forgot-password', values);
  });

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Forgot Password</h1>
      <form className="space-y-3" onSubmit={onSubmit}>
        <input className="w-full rounded border px-3 py-2" placeholder="Email" {...register('email')} />
        <Button type="submit">Send Reset Link</Button>
      </form>
    </div>
  );
}
