import { useActionState, useState } from 'react'

type DatabaseFormProps = {
  onClose: () => void
  onSaved: () => void
}

export default function DatabaseForm({ onClose, onSaved }: DatabaseFormProps) {
  const [values, setValues] = useState({
    host: 'localhost', port: '5432', dbname: '',
    username: '', password: '', sslmode: 'prefer',
  })
  const inputClass = 'mt-2 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-emerald-500'

  async function saveDatabase(_previousError: string | null, data: FormData): Promise<string | null> {
    try {
      const response = await fetch('http://127.0.0.1:8000/database/creatingEntry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: String(data.get('host')).trim(),
          port: Number(data.get('port')),
          dbname: String(data.get('dbname')).trim(),
          username: String(data.get('username')).trim(),
          password: data.get('password'),
          sslmode: data.get('sslmode'),
        }),
      })
      if (!response.ok) throw new Error('Could not save the connection. Check the fields and try again.')
      onSaved()
      return null
    } catch (error) {
      return error instanceof Error ? error.message : 'Could not save the connection.'
    }
  }

  const [error, formAction, submitting] = useActionState(saveDatabase, null)

  return (
    <section aria-labelledby="add-database-heading" className="min-w-0 p-6 md:col-start-1 md:row-start-1 lg:p-10">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 id="add-database-heading" className="text-lg font-semibold">Add database</h2>
        <button type="button" onClick={onClose} disabled={submitting} className="rounded px-2 py-1 text-sm text-zinc-400 hover:text-white disabled:opacity-40">Close</button>
      </div>
      <form action={formAction} className="rounded-xl border border-white/10 bg-[#121214] p-5">
        <fieldset disabled={submitting} className="grid gap-4 sm:grid-cols-2 disabled:opacity-60">
          <label className="text-sm text-zinc-400">Host
            <input autoFocus name="host" value={values.host} onChange={(event) => setValues({ ...values, host: event.target.value })} required pattern=".*\S.*" className={inputClass} />
          </label>
          <label className="text-sm text-zinc-400">Port
            <input name="port" value={values.port} onChange={(event) => setValues({ ...values, port: event.target.value })} type="number" required min="1" max="65535" className={inputClass} />
          </label>
          <label className="text-sm text-zinc-400 sm:col-span-2">Database name
            <input name="dbname" value={values.dbname} onChange={(event) => setValues({ ...values, dbname: event.target.value })} required pattern=".*\S.*" className={inputClass} />
          </label>
          <label className="text-sm text-zinc-400">Username
            <input name="username" value={values.username} onChange={(event) => setValues({ ...values, username: event.target.value })} autoComplete="username" required pattern=".*\S.*" className={inputClass} />
          </label>
          <label className="text-sm text-zinc-400">Password
            <input name="password" value={values.password} onChange={(event) => setValues({ ...values, password: event.target.value })} type="text" autoComplete="new-password" required className={inputClass} />
          </label>
          <label className="text-sm text-zinc-400 sm:col-span-2">SSL mode
            <select name="sslmode" value={values.sslmode} onChange={(event) => setValues({ ...values, sslmode: event.target.value })} className={inputClass}>
              {['disable', 'prefer', 'require', 'verify-ca', 'verify-full'].map((mode) => <option key={mode} value={mode}>{mode}</option>)}
            </select>
          </label>
          {error && <p role="alert" className="text-sm text-red-400 sm:col-span-2">{error}</p>}
          <div className="flex justify-end gap-3 sm:col-span-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800">Cancel</button>
            <button type="submit" className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
              {submitting ? 'Saving...' : 'Save database'}
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  )
}
