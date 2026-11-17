import fs from 'fs'
import path from 'path'
import ts from 'typescript'
import * as Icons from '@/app/components/ui/icons'

const cases = [
  ['app/finance/components/FinanceReportsClient.tsx', 'onClick={report.refresh}', ['RotateCw']],
  ['app/leads/page.tsx', 'onClick={handleClearFilters}', ['XCircle']],
  ['app/requirements/page.tsx', 'onClick={handleClearFilters}', ['XCircle']],
  ['app/records/[id]/components/RecordToolbar.tsx', 'onClick={onReload}', ['RotateCw']],
  ['app/sales/[id]/components/SaleDetailHeader.tsx', 'onClick={onPublish}', ['CheckCircle2']],
  ['app/sales/[id]/components/SaleDetailHeader.tsx', 'onClick={onUnpublish}', ['XCircle']],
  ['app/transactions/[id]/page.tsx', 'onClick={handlePublish}', ['CheckCircle2']],
  ['app/transactions/[id]/page.tsx', 'onClick={handleUnpublish}', ['XCircle']],
  ['app/purchases/orders/PurchaseOrderDetailShell.tsx', 'href={relatedQuotationHref}', ['FileText']],
  ['app/catalog/modifier-groups/[id]/page.tsx', 'onClick={handleSave}', ['Save', 'Loader']],
] as const

function readButton(file: string, selector: string) {
  const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8')
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const buttons: ts.JsxElement[] = []
  const importedIcons = new Set<string>()
  for (const statement of ast.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)
      || statement.moduleSpecifier.text !== '@/app/components/ui/icons') continue
    const bindings = statement.importClause?.namedBindings
    if (bindings && ts.isNamedImports(bindings)) {
      for (const icon of bindings.elements) {
        expect(Icons).toHaveProperty((icon.propertyName || icon.name).text)
        importedIcons.add(icon.name.text)
      }
    }
  }
  function visit(node: ts.Node) {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === 'Button'
      && node.getText(ast).includes(selector)) {
      let parent: ts.Node | undefined = node.parent
      while (parent && !(ts.isJsxElement(parent) && (
        parent.openingElement.tagName.getText(ast) === 'StickyHeader'
        || parent.openingElement.attributes.getText(ast).includes('data-toolbar-icon-actions')
      ))) parent = parent.parent
      if (parent) buttons.push(node)
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
  expect(buttons).toHaveLength(1)
  const button = buttons[0]
  const icons: string[] = []
  function findIcons(node: ts.Node) {
    const tag = ts.isJsxSelfClosingElement(node) ? node.tagName.getText(ast)
      : ts.isJsxElement(node) ? node.openingElement.tagName.getText(ast) : ''
    if (importedIcons.has(tag)) icons.push(tag)
    ts.forEachChild(node, findIcons)
  }
  for (const child of button.children) findIcons(child)
  return { button, ast, icons }
}

describe('explicit icons on contextual toolbar actions', () => {
  it.each(['onClick={handleAddToLeads}', 'onClick={() => setIsConfirmModalOpen(true)}'])
  ('keeps descriptive Finder action %s free of decorative icons', selector => {
    const { icons } = readButton('app/people/people-results-view.tsx', selector)
    expect(icons).toEqual(['Loader'])
  })

  it.each(cases)('%s %s keeps meaningful icons independent of its translated label', (file, selector, expected) => {
    const { icons } = readButton(file, selector)
    expect(icons).toEqual(expect.arrayContaining([...expected]))
    expect(icons).not.toContain('MoreHorizontal')
  })

  it('keeps the requirements filter count outside the automatically replaced children', () => {
    const { button, ast } = readButton('app/requirements/page.tsx', 'onClick={handleClearFilters}')
    const attributes = button.openingElement.attributes.getText(ast)
    expect(attributes).toContain('adornment={<Badge')
    expect(attributes).toContain('{activeFilterCount}</Badge>')
    expect(attributes).toContain('aria-label={`${t("requirements.clearFilters") || "Clear"} (${activeFilterCount})`}')
  })
})