export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#151519] px-6 text-center text-foreground">
      <div>
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you requested does not exist.
        </p>
      </div>
    </main>
  );
}
