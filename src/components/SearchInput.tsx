import { Search, X } from 'lucide-react'

export function SearchInput({ value, onChange, placeholder = 'Søg…', label = 'Søg' }: { value: string; onChange: (value: string) => void; placeholder?: string; label?: string }) {
  return (
    <label className="search-input">
      <span className="sr-only">{label}</span>
      <Search size={18} aria-hidden="true" />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      {value && <button type="button" aria-label="Ryd søgning" onClick={() => onChange('')}><X size={16} /></button>}
    </label>
  )
}
