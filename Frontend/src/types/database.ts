export type DatabaseEntry = {
  id: number
  host: string
  port: number
  dbname: string
  username: string
  created_at: string
}

export type DatabaseEntriesResponse = DatabaseEntry[]
