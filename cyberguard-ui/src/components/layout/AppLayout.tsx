import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

function ContentLoader() {
  return (
    <div className="h-[50vh] flex flex-col items-center justify-center gap-3">
      <div className="h-7 w-7 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      <p className="text-xs text-muted-foreground animate-pulse">Loading page...</p>
    </div>
  );
}

export function AppLayout() {
  return (
    <div className="flex min-h-screen w-full bg-background grid-pattern">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 p-6 overflow-auto">
          <Suspense fallback={<ContentLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
