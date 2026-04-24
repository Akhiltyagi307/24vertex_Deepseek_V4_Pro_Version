/**
 * Auth segment loading UI: shows immediately on navigation so the shell is not a blank
 * wait while `getUser` + signup RPCs resolve on the server.
 */
export default function AuthLoading() {
	return (
		<div className="flex w-full max-w-xs flex-1 flex-col justify-center space-y-4 py-6">
			<div className="h-8 w-2/3 animate-pulse rounded-md bg-muted" />
			<div className="h-3 w-full animate-pulse rounded-md bg-muted" />
			<div className="h-3 w-4/5 animate-pulse rounded-md bg-muted" />
			<div className="h-10 w-full animate-pulse rounded-md bg-muted" />
			<div className="h-10 w-full animate-pulse rounded-md bg-muted" />
		</div>
	);
}
