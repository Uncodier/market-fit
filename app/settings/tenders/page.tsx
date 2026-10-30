import { redirect } from 'next/navigation'

export default function TenderSettingsPage() {
  redirect('/settings?tab=tenders')
}