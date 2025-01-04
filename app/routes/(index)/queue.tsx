import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(index)/queue')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/(index)/queue"!</div>
}
