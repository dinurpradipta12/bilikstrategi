import Link from 'next/link';
import OfficeReview from '@/components/spatial-office/OfficeReview';

export const metadata = { title: 'Preview Kantor 3D — Bilik Strategi', robots: { index: false, follow: false } };
export default function OfficePreviewPage() {
  return <main className="office-preview-shell"><div className="office-preview-page">
    <Link className="office-preview-back" href="/dashboard">← Kembali ke dashboard</Link>
    <OfficeReview />
  </div></main>;
}
