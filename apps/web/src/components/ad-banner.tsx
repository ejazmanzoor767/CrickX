'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

type AdBannerProps = {
  slot?: string;
  className?: string;
};

export default function AdBanner({
  slot = process.env.NEXT_PUBLIC_ADSENSE_SLOT_RESPONSIVE,
  className = '',
}: AdBannerProps) {
  const pushed = useRef(false);
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

  useEffect(() => {
    if (!client || !slot || pushed.current) return;

    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
      pushed.current = true;
    } catch {
      // Ad blocking, a delayed AdSense script, or no ad fill must not block the page.
    }
  }, [client, slot]);

  if (!client || !slot) return null;

  return (
    <aside className={`ad-placement ${className}`} aria-label="Advertisement">
      <span className="ad-placement-label">Advertisement</span>
      <ins
        className="adsbygoogle"
        style={{ display: 'block', minHeight: 90 }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
