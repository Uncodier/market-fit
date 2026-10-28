import BuyerProfilePage from '@/app/buyer/profile/page'
import { CredentialManager } from './credential-manager'

export default function ProfilePage() {
  return <div className="space-y-8"><BuyerProfilePage /><CredentialManager /></div>
}