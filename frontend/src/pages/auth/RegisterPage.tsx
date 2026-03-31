import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { useRegister } from '@/hooks/useAuth';

const schema = z.object({
  tenantName: z.string().min(2, 'Business name must be at least 2 characters').max(100),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email').toLowerCase(),
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/[A-Za-z]/, 'Must contain a letter')
    .regex(/[0-9]/, 'Must contain a number'),
  terms: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms' }) })
});

type FormValues = z.infer<typeof schema>;

function passwordStrength(pw: string): { label: string; color: string } {
  if (pw.length === 0) return { label: '', color: '' };
  const hasLetter = /[A-Za-z]/.test(pw);
  const hasNumber = /[0-9]/.test(pw);
  const hasSpecial = /[^A-Za-z0-9]/.test(pw);
  const score = (pw.length >= 8 ? 1 : 0) + (hasLetter ? 1 : 0) + (hasNumber ? 1 : 0) + (hasSpecial ? 1 : 0);
  if (score <= 2) return { label: 'Weak', color: 'bg-red-400' };
  if (score === 3) return { label: 'Medium', color: 'bg-yellow-400' };
  return { label: 'Strong', color: 'bg-green-500' };
}

export function RegisterPage() {
  const { mutateAsync: register, isPending, error } = useRegister();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  const { register: reg, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema)
  });

  const passwordValue = watch('password', '');
  const strength = passwordStrength(passwordValue);

  const errorMessage = (() => {
    if (!error) return null;
    if (axios.isAxiosError(error)) {
      return (error.response?.data as { message?: string })?.message ?? 'Registration failed';
    }
    return 'Registration failed';
  })();

  const onSubmit = handleSubmit(async ({ terms: _terms, ...values }) => {
    const response = await register(values);
    const requiresOnboarding = response.data.data.requiresOnboarding;

    if (requiresOnboarding) {
      void navigate('/onboarding');
      return;
    }

    void navigate('/dashboard');
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Create your account</h1>

      {errorMessage && (
        <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
      )}

      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Business name</label>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            placeholder="Acme Corp"
            {...reg('tenantName')}
          />
          {errors.tenantName && <p className="mt-1 text-xs text-red-600">{errors.tenantName.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Full name</label>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            placeholder="Jane Doe"
            {...reg('name')}
          />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
          <input
            type="email"
            autoComplete="email"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            placeholder="you@example.com"
            {...reg('email')}
          />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              className="w-full rounded-md border border-slate-300 px-3 py-2 pr-10 text-sm focus:border-slate-500 focus:outline-none"
              placeholder="••••••••"
              {...reg('password')}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {passwordValue && (
            <div className="mt-2 space-y-1">
              <div className="h-1.5 w-full rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full transition-all ${strength.color}`}
                  style={{ width: strength.label === 'Weak' ? '33%' : strength.label === 'Medium' ? '66%' : '100%' }}
                />
              </div>
              <p className="text-xs text-slate-500">Strength: {strength.label}</p>
            </div>
          )}
          {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
        </div>

        <div className="flex items-start gap-2">
          <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300" {...reg('terms')} />
          <label className="text-sm text-slate-600">
            I agree to the <span className="text-slate-900 underline">Terms of Service</span>
          </label>
        </div>
        {errors.terms && <p className="text-xs text-red-600">{errors.terms.message}</p>}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </div>
  );
}
