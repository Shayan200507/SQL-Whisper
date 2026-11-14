import DatabaseListItem from '../../components/DatabaseListItem'
import DatabaseForm from '../../components/DatabaseForm'
import logo from '../../assets/sqlwhisper-logo.svg'
import { useActionState, useEffect, useState } from 'react'
import type { DatabaseEntriesResponse } from '../../types/database'
import type { QueryResponse, QueryState } from '../../types/query'

function Dashboard() {
  const [entries, setEntries] = useState<DatabaseEntriesResponse>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedDatabaseId, setSelectedDatabaseId] = useState<number | null>(null)
  const [prompts, setPrompts] = useState<Record<number, string>>({})
  const selectedDatabase = entries.find((entry) => entry.id === selectedDatabaseId) ?? entries[0]

  async function submitPrompt(_previous: QueryState, data: FormData): Promise<QueryState> {
    const databaseId = selectedDatabase?.id ?? null
    const prompt = String(data.get('prompt') ?? '').trim()
    if (databaseId === null || !prompt) {
      return { databaseId, result: null, error: 'Select a database and enter a prompt.' }
    }
    try {
      const response = await fetch(`http://127.0.0.1:8000/sql/prompt/${databaseId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(typeof body?.detail === 'string' ? body.detail : 'Could not run the query. Please try again.')
      }
      const result: QueryResponse = await response.json()
      if (!Array.isArray(result.columns) || !result.columns.every((column) => typeof column === 'string') || !Array.isArray(result.rows) || !result.rows.every(Array.isArray)) {
        throw new Error('The server returned an unexpected result format.')
      }
      return { databaseId, result, error: null }
    } catch (error) {
      return { databaseId, result: null, error: error instanceof Error ? error.message : 'Could not run the query.' }
    }
  }

  const [queryState, queryAction, querying] = useActionState<QueryState, FormData>(submitPrompt, {
    databaseId: null, result: null, error: null,
  })
  const currentQuery = queryState.databaseId === selectedDatabase?.id ? queryState : null

  useEffect(() => {
    const controller = new AbortController()

    async function fetchEntries() {
      try {
        const response = await fetch('http://127.0.0.1:8000/database/getEntries', {
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error('Could not load database connections.')
        }
        const data: DatabaseEntriesResponse = await response.json()
        if (!controller.signal.aborted) setEntries(data)
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(error instanceof Error ? error.message : 'Could not load database connections.')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void fetchEntries()
    return () => controller.abort()
  }, [refreshKey])

  function handleSaved() {
    setIsFormOpen(false)
    setLoading(true)
    setError(null)
    setRefreshKey((key) => key + 1)
  }

  return (
    <div className="min-h-dvh bg-[#0b0b0d] text-zinc-100">
      <header className=" flex border-b border-white/[0.07] bg-[#121214] h-[48px] items-center gap-3">
             
              <img
                src={logo}
                alt=""
                width="30"
                height="30"
                className='mt-[3px]'
              />

              <h1>SQLWhisper</h1>


      </header>
      <main className="grid min-h-[calc(100dvh-48px)] grid-cols-1 md:grid-cols-2">
        {isFormOpen && <DatabaseForm onClose={() => setIsFormOpen(false)} onSaved={handleSaved} />}
        {!isFormOpen && (
          <section aria-labelledby="query-heading" className="min-w-0 p-6 md:col-start-1 md:row-start-1 lg:p-10">
            <h2 id="query-heading" className="mb-5 break-words text-lg font-semibold tracking-tight">
              {selectedDatabase ? `Query ${selectedDatabase.dbname}` : 'Query your database'}
            </h2>
            <form action={queryAction}>
            <textarea
              name="prompt"
              required
              aria-labelledby="query-heading"
              rows={9}
              disabled={!selectedDatabase || loading || !!error || querying}
              value={selectedDatabase ? prompts[selectedDatabase.id] ?? '' : ''}
              onChange={(event) => {
                if (selectedDatabase) {
                  setPrompts((previous) => ({ ...previous, [selectedDatabase.id]: event.target.value }))
                }
              }}
              placeholder={selectedDatabase ? 'Describe what you want to know about your data...' : 'Add a database to start writing a query.'}
              className="w-full resize-y rounded-xl border border-white/10 bg-[#121214] p-5 text-sm leading-6 text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
            />
              <div className="mt-3 flex justify-end">
                <button type="submit" disabled={!selectedDatabase || loading || !!error || querying || !(prompts[selectedDatabase?.id ?? -1] ?? '').trim()} className="rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40">
                  {querying ? 'Running query...' : 'Submit prompt'}
                </button>
              </div>
            </form>
            {querying && <p role="status" className="mt-5 text-sm text-zinc-400">Generating SQL and fetching results...</p>}
            {!querying && currentQuery?.error && <p role="alert" className="mt-5 text-sm text-red-400">{currentQuery.error}</p>}
            {!querying && currentQuery?.result && (
              <section aria-label="Query results" className="mt-6">
                <h3 className="mb-3 text-sm font-semibold">Results ({currentQuery.result.rows.length} rows)</h3>
                {currentQuery.result.rows.length === 0 ? (
                  <p className="text-sm text-zinc-400">No matching rows found.</p>
                ) : (
                  <div className="max-h-[50dvh] overflow-auto rounded-xl border border-white/10">
                    <table className="w-full text-left text-sm">
                      <caption className="sr-only">Results for {selectedDatabase?.dbname}</caption>
                      <thead className="bg-zinc-900 text-zinc-300">
                        <tr>{currentQuery.result.columns.map((column, index) => <th key={index} scope="col" className="whitespace-nowrap px-4 py-3 font-medium">{column}</th>)}</tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {currentQuery.result.rows.map((row, rowIndex) => (
                          <tr key={rowIndex}>{row.map((value, columnIndex) => (
                            <td key={columnIndex} className="whitespace-pre-wrap px-4 py-3 text-zinc-400">
                              {value === null ? <span className="italic text-zinc-600">NULL</span> : typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            </td>
                          ))}</tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}
          </section>
        )}
        <section aria-labelledby="databases-heading" className="min-w-0 border-white/[0.07] p-6 md:col-start-2 md:border-l lg:p-10">
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <h2 id="databases-heading" className="text-lg font-semibold tracking-tight">Your databases</h2>
            {!loading && !error && (
              <span className="rounded-md border border-white/10 bg-zinc-900 px-2 py-0.5 text-xs text-zinc-400">{entries.length}</span>
            )}
            <div className="ml-auto">
            <button
              type="button"
              onClick={() => setIsFormOpen(true)}
              disabled={isFormOpen || querying}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-400 transition-transform duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span aria-hidden="true" className="text-lg leading-none">+</span>
              Add database
            </button>
            </div>
          </div>
          <div inert={isFormOpen || querying} aria-disabled={isFormOpen || querying} className={`overflow-hidden rounded-xl border border-white/10 bg-[#121214] ${isFormOpen || querying ? 'pointer-events-none opacity-40' : ''}`}>
            {loading && <p role="status" className="p-5 text-sm text-zinc-400">Loading connections...</p>}
            {error && <p role="alert" className="p-5 text-sm text-red-400">{error}</p>}
            {!loading && !error && entries.length === 0 && (
              <p className="p-5 text-sm text-zinc-400">No database connections yet.</p>
            )}
            {!loading && !error && entries.length > 0 && (
              <ul aria-label="Database connections" className="max-h-[65dvh] divide-y divide-white/[0.07] overflow-y-auto">
                {entries.map((entry) => (
                  <DatabaseListItem
                    key={entry.id}
                    database={entry}
                    selected={entry.id === selectedDatabase?.id}
                    onSelect={() => setSelectedDatabaseId(entry.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        </section>

      </main>
   
    </div>
  )
}

export default Dashboard
