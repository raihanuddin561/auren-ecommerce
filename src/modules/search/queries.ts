import 'server-only';
import * as service from './service';

export async function getSearchResults(query: string, limit = 24) {
  return service.executeSearch(query, limit);
}

export async function getSearchSuggestions(query: string) {
  return service.getLiveSearchSuggestions(query);
}
