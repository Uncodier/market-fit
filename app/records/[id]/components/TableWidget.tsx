import React, { useState } from "react"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { PlusCircle, Trash2 } from "@/app/components/ui/icons"

interface TableRow {
  [key: string]: any
}

export function TableWidget({ value, onChange }: { value: TableRow[], onChange: (val: TableRow[]) => void }) {
  const [columns, setColumns] = useState<string[]>(
    value.length > 0 ? Object.keys(value[0]) : ["Column 1"]
  )

  const rows = Array.isArray(value) ? value : []

  const addColumn = () => {
    const newColName = `Column ${columns.length + 1}`
    setColumns([...columns, newColName])
    // update all rows with new column
    onChange(rows.map(row => ({ ...row, [newColName]: "" })))
  }

  const addRow = () => {
    const newRow: TableRow = {}
    columns.forEach(c => newRow[c] = "")
    onChange([...rows, newRow])
  }

  const removeRow = (index: number) => {
    const newRows = [...rows]
    newRows.splice(index, 1)
    onChange(newRows)
  }

  const updateCell = (rowIndex: number, colName: string, val: string) => {
    const newRows = [...rows]
    newRows[rowIndex] = { ...newRows[rowIndex], [colName]: val }
    onChange(newRows)
  }

  const updateColumnName = (oldName: string, newName: string) => {
    if (!newName || newName === oldName) return
    
    // rename in columns array
    const newCols = columns.map(c => c === oldName ? newName : c)
    setColumns(newCols)

    // rename in data
    const newRows = rows.map(row => {
      const { [oldName]: oldVal, ...rest } = row
      return { ...rest, [newName]: oldVal }
    })
    onChange(newRows)
  }

  return (
    <div className="space-y-4 border rounded-md p-4 bg-background">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
            <tr>
              {columns.map((col, i) => (
                <th key={i} className="px-4 py-2 font-medium">
                  <Input 
                    defaultValue={col} 
                    onBlur={(e) => updateColumnName(col, e.target.value)}
                    className="h-8 border-transparent bg-transparent shadow-none px-1 py-0 font-medium uppercase text-xs hover:border-border"
                  />
                </th>
              ))}
              <th className="px-4 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b border-border/50 hover:bg-muted/30">
                {columns.map((col, colIndex) => (
                  <td key={colIndex} className="px-2 py-2">
                    <Input 
                      value={row[col] || ""} 
                      onChange={(e) => updateCell(rowIndex, col, e.target.value)}
                      className="h-8 border-transparent bg-transparent shadow-none px-2 focus-visible:ring-1 hover:border-border"
                    />
                  </td>
                ))}
                <td className="px-2 py-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeRow(rowIndex)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={addRow}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Row
        </Button>
        <Button variant="outline" size="sm" onClick={addColumn}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Column
        </Button>
      </div>
    </div>
  )
}