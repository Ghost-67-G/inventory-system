import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { authApi } from '@/api/endpoints/auth';
import { Button } from '@/components/ui/button';

const schema = z.object({
  email: z.string().email('Invalid email')
});
type FormValues = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema)
  });

  const onSubmit = handleSubmit(async (values) => {
    setIsLoading(true);
    setError(null);
    try {
      await authApi.forgotPassword(values.email);
      setSubmitted(true);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError((err.response?.data as { message?: string })?.message ?? 'Something went wrong');
      }
    } finally {
      setIsLoading(false);
    }
  });

  if (submitted) {
    return (
      <div className="text-center">
        <h1 className="mb-3 text-2xl font-semibold text-slate-900">Check your email</h1>
        <p className="mb-6 text-sm text-slate-600">
          If that email address is registered, we sent a password reset link to it.
        </p>
        <Link to="/login" className="text-sm text-slate-600 hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold text-slate-900">Forgot password?</h1>
      <p className="mb-6 text-sm text-slate-600">Enter your email and we'll send a reset link.</p>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
          <input
            type="email"
            autoComplete="email"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm placeholder-slate-400 focus:border-slate-500 focus:outline-none"
            placeholder="you@example.com"
            {...register('email')}
          />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? 'Sending…' : 'Send reset link'}
        </Button>

        <p className="text-center text-sm">
          <Link to="/login" className="text-slate-600 hover:underline">
            Back to sign in
          </Link>
        </p>
      </form>
    </div>
  );
}

