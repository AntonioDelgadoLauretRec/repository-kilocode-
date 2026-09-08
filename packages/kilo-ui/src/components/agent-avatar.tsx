import { createMemo, For } from "solid-js"
import { identity } from "./agent-avatar-identity"

export function AgentAvatar(props: { id: string; running?: boolean }) {
  const avatar = createMemo(() => identity(props.id))
  return (
    <svg
      data-component="agent-avatar"
      data-color={avatar().color}
      data-running={props.running || undefined}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      aria-hidden="true"
    >
      <For each={avatar().cells}>
        {(cell) => (
          <rect
            x={2 + (cell % 5) * 3}
            y={2 + Math.floor(cell / 5) * 3}
            width="3"
            height="3"
            style={{ "animation-delay": `${-((cell % 5) + Math.floor(cell / 5)) * 0.12}s` }}
          />
        )}
      </For>
    </svg>
  )
}
