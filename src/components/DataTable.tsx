export interface Column<T> {
  key: string
  header: string
  render: (row: T) => React.ReactNode
  className?: string
}

export function DataTable<T extends { id: string }>({ columns, rows, label }: { columns: Column<T>[]; rows: T[]; label: string }) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <caption className="sr-only">{label}</caption>
        <thead><tr>{columns.map((column) => <th key={column.key} scope="col" className={column.className}>{column.header}</th>)}</tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id}>{columns.map((column) => <td key={column.key} className={column.className} data-label={column.header}>{column.render(row)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}
