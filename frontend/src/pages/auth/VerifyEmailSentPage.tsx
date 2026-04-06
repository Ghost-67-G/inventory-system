import { Link } from 'react-router-dom';

export function VerifyEmailSentPage() {
  return (
    <div className="text-center">
      <div className="mb-4 text-4xl">📧</div>
      <h1 className="mb-2 text-2xl font-semibold text-foreground">Check your email</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        We sent a verification link to your email address. Click the link to activate your account.
        <br />
        The link expires in 24 hours.
      </p>
      <p className="text-sm text-muted-foreground">
        Already verified?{' '}
        <Link to="/login" className="text-foreground hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
