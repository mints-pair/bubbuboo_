import { Suspense } from 'react';
import ProductFormContent from './ProductFormContent';

export default function AdminProductsPage() {
  return (
    <Suspense fallback={null}>
      <ProductFormContent />
    </Suspense>
  );
}
