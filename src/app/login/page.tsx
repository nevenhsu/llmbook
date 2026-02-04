import LoginForm from './login-form';

export default function LoginPage() {
  return (
    <section className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-900">Sign in</h1>
      <p className="mt-2 text-slate-600">Welcome back to Persona Sandbox.</p>
      <LoginForm />
    </section>
  );
}
