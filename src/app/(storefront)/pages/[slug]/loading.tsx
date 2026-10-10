export default function PageLoading() {
  return (
    <article className="min-h-screen py-10 md:py-16">
      <header className="mx-auto mb-12 max-w-4xl space-y-3 px-6 text-center">
        <div className="mx-auto h-10 w-3/4 max-w-md animate-skeleton rounded-xs bg-skeleton md:h-14" />
        <div className="mx-auto h-4 w-1/2 max-w-sm animate-skeleton rounded-xs bg-skeleton" />
      </header>
      <div className="container-page space-y-12">
        <div className="h-64 w-full animate-skeleton rounded-xs bg-skeleton" />
      </div>
    </article>
  );
}
