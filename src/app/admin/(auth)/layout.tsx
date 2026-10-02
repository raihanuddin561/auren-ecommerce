export default function AdminAuthLayout({ children }: LayoutProps<'/admin'>) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-10 px-6 py-16">
      <p className="type-wordmark text-h3 leading-none text-fg">AUREN</p>
      {children}
    </main>
  );
}
