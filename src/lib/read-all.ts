/** Fetch every page explicitly so financial totals never silently stop at the API row cap. */
export async function readAll<T>(query: (from: number, to: number) => PromiseLike<{
  data: T[] | null
  error: { message: string } | null
}>) {
  const data: T[] = []
  const pageSize = 500
  for (let from = 0; ; from += pageSize) {
    const result = await query(from, from + pageSize - 1)
    if (result.error) throw new Error(result.error.message)
    const page = result.data || []
    data.push(...page)
    if (page.length < pageSize) return { data }
  }
}
