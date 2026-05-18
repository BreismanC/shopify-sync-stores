import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) {
    throw new Error('An error occurred while fetching the data.');
  }
  return res.json();
});

export function useApi<T>(url: string): { data: T | undefined; error: Error | undefined; isLoading: boolean } {
  const { data, error, isLoading } = useSWR<T>(url, fetcher);

  return { data, error, isLoading };
}
