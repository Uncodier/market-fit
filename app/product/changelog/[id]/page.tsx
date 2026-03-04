import React from 'react'
import ChangelogDetailClient from './ChangelogDetailClient'

export async function generateStaticParams() {
  const { changelogData } = await import('../changelog-data')
  return changelogData.map((release) => ({
    id: release.id,
  }))
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ChangelogDetailClient id={id} />
}
