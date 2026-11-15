export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 text-center">
      <div>
        <h1 className="text-[19px] font-semibold">Page not found</h1>
        <p className="mt-2 text-[12px] text-muted-foreground">The page you requested does not exist.</p>
      </div>
    </main>
  );
}
