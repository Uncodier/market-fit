import { ReplenishmentRuleDetail } from '@/app/purchases/procurement/replenishment/detail'

export default async function InventoryMinimumRulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ReplenishmentRuleDetail ruleId={id} />
}