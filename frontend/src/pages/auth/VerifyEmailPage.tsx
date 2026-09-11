import axios from 'axios';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi } from '@/api/endpoints/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/store/authStore';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendEmail, setResendEmail] = useState('');
  const currentUser = useAuthStore((state) => state.user);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage('No verification token found in URL.');
      return;
    }

    authApi
      .verifyEmail(token)
      .then(() => setStatus('success'))
      .catch((err: unknown) => {
        setStatus('error');
        if (axios.isAxiosError(err)) {
          setErrorMessage(
            (err.response?.data as { message?: string })?.message ?? 'Verification failed.'
          );
        } else {
          setErrorMessage('Verification failed.');
        }
      });
  }, [token]);

  const handleResend = async () => {
    const email = currentUser?.email ?? resendEmail.trim();
    if (!email) {
      setResendError('Enter the email address you registered with.');
      return;
    }

    setResending(true);
    setResendError(null);
    try {
      await authApi.resendVerification(currentUser ? undefined : email);
      setResent(true);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setResendError((err.response?.data as { message?: string })?.message ?? 'Could not resend the email.');
      } else {
        setResendError('Could not resend the email.');
      }
    } finally {
      setResending(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-foreground" />
        <p className="text-sm text-muted-foreground">Verifying your email…</p>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="text-center">
        <div className="mb-4 text-4xl">✅</div>
        <h1 className="mb-2 text-2xl font-semibold text-foreground">Email verified!</h1>
        <p className="mb-6 text-sm text-muted-foreground">Your email is verified. You can now sign in.</p>
        <Button asChild>
          <Link to="/login">Go to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="mb-4 text-4xl">❌</div>
      <h1 className="mb-2 text-2xl font-semibold text-foreground">Verification failed</h1>
      <p className="mb-6 text-sm text-red-600 dark:text-red-400">{errorMessage}</p>

      {resent ? (
        <p className="text-sm text-muted-foreground" role="status">
          If that address still needs verification, a new email is on its way.
        </p>
      ) : (
        <form
          className="mx-auto flex max-w-sm flex-col gap-2 text-left"
          onSubmit={(event) => {
            event.preventDefault();
            void handleResend();
          }}
        >
          {currentUser ? null : (
            <>
              <label htmlFor="resend-email" className="text-sm font-medium text-foreground">
                Email address
              </label>
              <Input
                id="resend-email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={resendEmail}
                onChange={(event) => setResendEmail(event.target.value)}
                required
              />
            </>
          )}
          <Button type="submit" disabled={resending}>
            {resending ? 'Sending…' : 'Resend verification email'}
          </Button>
        </form>
      )}
      {resendError ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">{resendError}</p> : null}

      <p className="mt-4 text-sm">
        <Link to="/login" className="text-muted-foreground hover:text-foreground hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
