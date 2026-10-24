import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useSession } from '@/hooks/useSession'

// Temporary test page (✅ D): shows the anonymous user id. Reloading must keep the same id.
function App() {
  const { userId, loading, error } = useSession()

  return (
    <main className="mx-auto max-w-md p-6">
      <Card>
        <CardHeader>
          <CardTitle>unmute</CardTitle>
          <CardDescription>Anonymous session test</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && <p>Signing in…</p>}
          {error && <p className="text-destructive">Error: {error.message}</p>}
          {userId && (
            <>
              <p className="font-mono text-sm break-all">{userId}</p>
              <Button onClick={() => navigator.clipboard.writeText(userId)}>Copy user id</Button>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  )
}

export default App
