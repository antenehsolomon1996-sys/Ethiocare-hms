import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
			staleTime: 30000, // 30 seconds fresh window to avoid duplicate Supabase API calls
			gcTime: 300000,    // 5 minutes garbage collection cache time
		},
	},
});