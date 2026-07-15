import { Suspense } from 'react';
import TrackingContent from './TrackingContent';

export default function TrackingPage() {
  return (
    <Suspense fallback={<div className="container">กำลังโหลด...</div>}>
      <TrackingContent />
    </Suspense>
  );
}
