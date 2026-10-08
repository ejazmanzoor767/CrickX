'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

// Client-side gate: redirects to /admin/login if there's no token. The real
// authorization boundary is server-side (RolesGuard on the API) — this is
// just UX so non-admins don't see a flash of the admin shell.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token && pathname !== '/admin/login') {
      router.replace('/admin/login');
      return;
    }
    setReady(true);
  }, [pathname, router]);

  if (!ready && pathname !== '/admin/login') return null;
  return <div>{children}</div>;
}
