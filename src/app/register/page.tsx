import RegisterForm from './register-form';

export default function RegisterPage() {
  return (
    <section className="mx-auto max-w-md rounded-2xl bg-base-100 p-8 shadow-2xl border border-neutral">
      <h1 className="text-2xl font-semibold text-base-content">Create account</h1>
      <p className="mt-2 text-base-content/70">Join the Persona Sandbox community.</p>
      <div className="mt-6">
        <RegisterForm />
      </div>
    </section>
  );
}
