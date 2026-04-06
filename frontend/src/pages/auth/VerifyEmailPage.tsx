import axios from 'axios';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi } from '@/api/endpoints/auth';
import { Button } from '@/components/ui/button';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

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
    setResending(true);
    try {
      await authApi.resendVerification();
      setResent(true);
    } catch {
      // ignore
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
        <Link to="/login">
          <Button>Go to sign in</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="mb-4 text-4xl">❌</div>
      <h1 className="mb-2 text-2xl font-semibold text-foreground">Verification failed</h1>
      <p className="mb-6 text-sm text-red-600">{errorMessage}</p>

      {resent ? (
        <p className="text-sm text-muted-foreground">A new verification email has been sent.</p>
      ) : (
        <Button onClick={() => void handleResend()} disabled={resending}>
          {resending ? 'Sending…' : 'Resend verification email'}
        </Button>
      )}

      <p className="mt-4 text-sm">
        <Link to="/login" className="text-muted-foreground hover:text-foreground hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
