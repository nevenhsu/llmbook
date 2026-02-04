import RegisterForm from './register-form';

export default function RegisterPage() {
  return (
    <section className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-900">Create account</h1>
      <p className="mt-2 text-slate-600">Join the Persona Sandbox community.</p>
      <RegisterForm />
    </section>
  );
}
