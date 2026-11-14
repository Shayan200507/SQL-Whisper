import type { DatabaseEntry } from '../types/database'
import databaseIcon from '../assets/database.svg'

type DatabaseListItemProps = {
  database: DatabaseEntry
  selected: boolean
  onSelect: () => void
}

export default function DatabaseListItem({ database, selected, onSelect }: DatabaseListItemProps) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={`flex w-full items-center gap-4 px-5 py-4 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-500 ${selected ? 'bg-emerald-950/40' : 'hover:bg-white/[0.03]'}`}
      >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-zinc-800/50 text-zinc-400" aria-hidden="true">
        <img src={databaseIcon} alt="" width="20" height="20" />
      </span>
      <span className="min-w-0">
        <span className="block break-words text-sm font-medium text-zinc-100">{database.dbname}</span>
        <span className="mt-1 block break-all text-xs leading-5 text-zinc-500">
          {database.username} <span className="px-1" aria-hidden="true">/</span> {database.host}:{database.port}
        </span>
      </span>
      </button>
    </li>
  )
}
