import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createAccount } from '../../actions';
import { AccountForm } from '../AccountForm';

export default function NewAccountPage() {
  return (
    <div className="page">
      <Link href="/accounts" className="row muted" style={{ gap: 6 }}><ArrowLeft size={16} />アカウント一覧</Link>
      <h1>アカウントを追加</h1>
      <AccountForm action={createAccount} isNew />
    </div>
  );
}
