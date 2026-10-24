import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

// Temporary check page: proves Tailwind + shadcn + the @ alias work.
// Replaced by the anonymous-session test page in the Supabase step.
function App() {
  return (
    <main className="mx-auto max-w-md p-6">
      <Card>
        <CardHeader>
          <CardTitle>unmute</CardTitle>
          <CardDescription>Web skeleton is running.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => alert('shadcn works')}>Click me</Button>
        </CardContent>
      </Card>
    </main>
  )
}

export default App
