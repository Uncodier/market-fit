'use client'

import { useState } from 'react'
import { RequestList } from '../../requests/request-list'
import { EventApprovalQueue } from './event-queue'
import { ProcurementWorkspace } from '../ui/workspace'
import { Tabs, TabsList, TabsTrigger } from '@/app/components/ui/tabs'

export default function Page() {
  const [view, setView] = useState('requests')
  const tabs = <Tabs value={view} onValueChange={setView}><TabsList><TabsTrigger value="requests">Requisitions</TabsTrigger><TabsTrigger value="events">Publication and commitments</TabsTrigger></TabsList></Tabs>
  if (view === 'requests') return <RequestList approvals toolbarStart={tabs} />
  return <ProcurementWorkspace title="Approvals" toolbar={tabs}><EventApprovalQueue /></ProcurementWorkspace>
}
