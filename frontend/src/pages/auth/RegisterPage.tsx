import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
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
    try {
      await register(values);
    } catch {
      // Error is surfaced via the mutation's `error` state above.
      return;
    }

    // Registration does not issue a session (the user must verify their email
    // first), so send them to the "check your email" screen instead of a
    // protected route that would bounce back to /login.
    void navigate('/verify-email-sent');
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-foreground">Create your account</h1>

      {errorMessage && (
        <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">{errorMessage}</div>
      )}

      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <label htmlFor="register-tenant-name" className="mb-1 block text-sm font-medium text-foreground">Business name</label>
          <input
            id="register-tenant-name"
            autoComplete="organization"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
            placeholder="Acme Corp"
            {...reg('tenantName')}
          />
          {errors.tenantName && <p className="mt-1 text-xs text-red-600">{errors.tenantName.message}</p>}
        </div>

        <div>
          <label htmlFor="register-name" className="mb-1 block text-sm font-medium text-foreground">Full name</label>
          <input
            id="register-name"
            autoComplete="name"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
            placeholder="Jane Doe"
            {...reg('name')}
          />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
        </div>

        <div>
          <label htmlFor="register-email" className="mb-1 block text-sm font-medium text-foreground">Email</label>
          <input
            id="register-email"
            type="email"
            autoComplete="email"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
            placeholder="you@example.com"
            {...reg('email')}
          />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>

        <div>
          <label htmlFor="register-password" className="mb-1 block text-sm font-medium text-foreground">Password</label>
          <div className="relative">
            <input
              id="register-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              className="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
              placeholder="••••••••"
              {...reg('password')}
            />
            <button
              type="button"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {passwordValue && (
            <div className="mt-2 space-y-1">
              <div className="h-1.5 w-full rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${strength.color}`}
                  style={{ width: strength.label === 'Weak' ? '33%' : strength.label === 'Medium' ? '66%' : '100%' }}
                />
              </div>
              <p className="text-xs text-muted-foreground">Strength: {strength.label}</p>
            </div>
          )}
          {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
        </div>

        <div className="flex items-start gap-2">
          <input id="register-terms" type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 rounded border-input" {...reg('terms')} />
          <label htmlFor="register-terms" className="text-sm text-muted-foreground">
            I agree to the <span className="text-foreground underline">Terms of Service</span>
          </label>
        </div>
        {errors.terms && <p className="text-xs text-red-600">{errors.terms.message}</p>}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? 'Creating account…' : 'Create account'}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link to="/login" className="text-foreground hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
