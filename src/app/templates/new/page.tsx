import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createTemplate } from '../../actions';
import { TemplateForm } from '../TemplateForm';

export default function NewTemplatePage() {
  return (
    <div className="page">
      <Link href="/templates" className="row muted" style={{ gap: 6 }}><ArrowLeft size={16} />構成案一覧</Link>
      <h1>構成案を追加</h1>
      <TemplateForm action={createTemplate} isNew />
    </div>
  );
}
