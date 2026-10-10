import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createResearchMethod } from '../../actions';
import { ResearchMethodForm } from '../ResearchMethodForm';

export default function NewResearchMethodPage() {
  return (
    <div className="page">
      <Link href="/research-methods" className="row muted" style={{ gap: 6 }}><ArrowLeft size={16} />リサーチ手法一覧</Link>
      <h1>リサーチ手法を追加</h1>
      <ResearchMethodForm action={createResearchMethod} isNew />
    </div>
  );
}
