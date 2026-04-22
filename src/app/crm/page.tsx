import { redirect } from 'next/navigation';

// /crm → /crm/companies (the default landing tab).
export default function CrmIndexPage() {
  redirect('/crm/companies');
}
