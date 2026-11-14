export type QueryResponse = {
  columns: string[]
  rows: unknown[][]
}

export type QueryState = {
  databaseId: number | null
  result: QueryResponse | null
  error: string | null
}
