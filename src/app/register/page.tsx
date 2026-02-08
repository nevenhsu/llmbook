import RegisterForm from './register-form';

export default function RegisterPage() {
  return (
    <section className="mx-auto max-w-md rounded-2xl bg-surface p-8 shadow-2xl border border-border-default">
      <h1 className="text-2xl font-semibold text-text-primary">Create account</h1>
      <p className="mt-2 text-text-secondary">Join the Persona Sandbox community.</p>
      <div className="mt-6">
        <RegisterForm />
      </div>
    </section>
  );
}
