import fs from 'fs'
import path from 'path'
import ts from 'typescript'

const screens = {
  sales: 'app/sales/[id]/components/SaleDetailHeader.tsx',
  orders: 'app/orders/[id]/components/OrderDetailView.tsx',
  purchases: 'app/purchases/orders/PurchaseOrderDetailShell.tsx',
}

function toolbarGroups(file: string) {
  const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8')
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const groups = new Map<string, string>()
  let toolbar = ''
  function visit(node: ts.Node) {
    if (ts.isJsxElement(node)) {
      const tag = node.openingElement.tagName.getText(ast)
      if (tag === 'ToolbarActionGroups') toolbar = node.getText(ast)
      if (tag === 'ToolbarActionGroup') {
        const label = node.openingElement.attributes.properties.find(
          (attribute): attribute is ts.JsxAttribute => ts.isJsxAttribute(attribute) && attribute.name.getText(ast) === 'label',
        )
        if (label?.initializer && ts.isStringLiteral(label.initializer)) {
          groups.set(label.initializer.text, node.getText(ast))
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
  return { groups, toolbar, source }
}

describe('commerce contextual toolbar groups', () => {
  it.each(Object.values(screens))('%s uses shared groups without individual separators', (file) => {
    const { toolbar, source } = toolbarGroups(file)
    expect(toolbar).toBeTruthy()
    expect(toolbar).not.toMatch(/w-px|bg-border|<Separator\b|role=["']separator/)
    expect(source.split('\n').length).toBeLessThan(500)
  })

  it('groups sale editing, delivery, accounting, and deletion by context', () => {
    const { groups, toolbar } = toolbarGroups(screens.sales)
    expect([...groups.keys()]).toEqual(['Document actions', 'Delivery actions', 'Accounting actions', 'Destructive actions'])
    expect(groups.get('Document actions')).toContain('onClick={onEdit}')
    for (const handler of ['onPrint', 'onSend', 'onCopyClientLink']) {
      expect(groups.get('Delivery actions')).toContain(`onClick={${handler}}`)
    }
    for (const handler of ['onRegisterPayment', 'onPublish', 'onUnpublish']) {
      expect(groups.get('Accounting actions')).toContain(`onClick={${handler}}`)
    }
    expect(groups.get('Destructive actions')).toContain('onClick={onDelete}')
    expect(groups.get('Destructive actions')).toContain('<AlertDialog>')
    expect(toolbar.indexOf('onPrint')).toBeLessThan(toolbar.indexOf('onRegisterPayment'))
    expect(groups.get('Delivery actions')).toContain('sale.status !== "cancelled"')
    expect(groups.get('Accounting actions')).toContain('sale.amount_due > 0')
    expect(groups.get('Accounting actions')).toContain('sale.accountingState !== "posted"')
  })

  it('keeps order document delivery together and payment conditional', () => {
    const { groups, source } = toolbarGroups(screens.orders)
    expect([...groups.keys()]).toEqual(['Document actions', 'Accounting actions'])
    for (const handler of ['onSend', 'onCopyClientLink', 'onPrint']) {
      expect(groups.get('Document actions')).toContain(`onClick={props.${handler}}`)
    }
    expect(groups.get('Document actions')).toContain('disabled={!providerAccepted(order.metadata)}')
    expect(groups.get('Accounting actions')).toContain('onClick={props.onOpenPayment}')
    expect(groups.get('Accounting actions')).toContain('!external && order.status !== "cancelled" && Number(order.sales?.amount_due) > 0')
    expect(source).toContain('onClick={props.onCreateShipment}')
    expect(source).toContain('<RegisterPaymentDialog')
  })

  it('groups purchase navigation including quotation separately from printing and buying', () => {
    const { groups, source } = toolbarGroups(screens.purchases)
    expect([...groups.keys()]).toEqual(['Navigation actions', 'Document actions', 'Purchasing actions'])
    expect(groups.get('Navigation actions')).toContain('href="/purchases/orders"')
    expect(groups.get('Navigation actions')).toContain('order && relatedQuotationHref')
    expect(groups.get('Navigation actions')).toContain('href={relatedQuotationHref}')
    expect(groups.get('Document actions')).toContain('window.print()')
    expect(groups.get('Purchasing actions')).toContain('order && buyAgainHref')
    expect(groups.get('Purchasing actions')).toContain('href={buyAgainHref}')
    expect(source).toContain('Read-only')
    expect(source).toContain('onStatusChange={() => {}} disabled')
  })
})