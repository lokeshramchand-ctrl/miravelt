import LoginForm from "./LoginForm";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const nextParam = params.next;
  const next = typeof nextParam === "string" && nextParam.startsWith("/dashboard") ? nextParam : "/dashboard";

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-[400px] rounded-3xl border border-border-button-white bg-background-secondary-default p-2 shadow-sidebar">
        <div className="rounded-2xl bg-background-primary-default p-6 shadow-card">
          <span className="flex size-10 items-center justify-center rounded-2lg bg-text-primary text-title-3-semibold text-background-full shadow-xs">M</span>
          <h1 className="mt-5 text-title-2-medium text-text-primary">Miravelt Admin</h1>
          <p className="mt-1 text-body-regular text-text-secondary">Sign in with an admin account.</p>
          <div className="mt-6">
            <LoginForm next={next} />
          </div>
        </div>
        <p className="px-4 py-3 text-center text-caption-1-regular text-text-tertiary">Operators only. Access is checked against the backend on every sign-in.</p>
      </div>
    </div>
  );
}
