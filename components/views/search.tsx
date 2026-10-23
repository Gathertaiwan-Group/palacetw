import { getIndex } from "@/lib/data";
import { search } from "@/lib/search";
import { SearchView } from "./content";

export async function renderSearch(q: string, num: number) {
  const ix = await getIndex();
  const results = await search(ix, q);
  return <SearchView ix={ix} q={q} results={results} page={num} />;
}
