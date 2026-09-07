/** @jsxImportSource solid-js */

/**
 * SessionDock component
 *
 * One row between the transcript and the composer. It shows the working
 * indicator while a turn runs, the session actions (New Session, Fork Session,
 * Move to Worktree, changes) once it finishes, and nothing while a permission,
 * question, or requirement surface owns the interaction.
 *
 * The transcript viewport is whatever is left above the composer, so a row that
 * grew when the actions appeared shifted the visible conversation by its own
 * height. Both states are therefore always laid out, stacked in one grid cell,
 * and only the active one is visible. The row measures the taller state at the
 * current width, which also keeps the wrapped narrow-sidebar actions row from
 * being clipped.
 */

import { Show, createEffect, createSignal, onCleanup, type Component, type JSX } from "solid-js"
import { Button } from "@kilocode/kilo-ui/button"
import { DropdownMenu } from "@kilocode/kilo-ui/dropdown-menu"
import { Icon } from "@kilocode/kilo-ui/icon"
import { Tooltip } from "@kilocode/kilo-ui/tooltip"
import { useSession } from "../../context/session"
import { useLanguage } from "../../context/language"
import { useServer } from "../../context/server"
import { WorkingIndicator } from "../shared/WorkingIndicator"
import { showsWorking } from "../shared/working-indicator-utils"

interface SessionDockProps {
  /** Idle-state content. Renders nothing when no action applies. */
  actions?: (goal: () => JSX.Element) => JSX.Element
  /** Whether idle-state content exists for this surface. */
  hasActions?: () => boolean
  /** True while a permission, question, suggestion, or requirement owns the row. */
  blocked?: boolean
  readonly?: boolean
}

export const SessionDock: Component<SessionDockProps> = (props) => {
  const session = useSession()
  const language = useLanguage()
  const server = useServer()
  const goal = () => session.currentSession()?.goal
  const working = () => showsWorking(session.status(), session.submitting(), !!props.blocked)
  const actions = () => !working() && !props.blocked && (props.hasActions?.() ?? false)
  const active = () => working() || actions()
  const label = () =>
    `${language.t("session.goal.label")}: ${language.t(goal()?.active ? "session.goal.active" : "session.goal.paused")}`
  const [open, setOpen] = createSignal(false)
  const [row, setRow] = createSignal<HTMLDivElement>()
  const [lane, setLane] = createSignal<HTMLDivElement>()
  const [badge, setBadge] = createSignal<HTMLSpanElement>()
  const [text, setText] = createSignal<HTMLSpanElement>()
  const [compact, setCompact] = createSignal(false)

  createEffect(() => {
    if (!actions() || !goal()) setOpen(false)
  })

  createEffect(() => {
    const trigger = badge()?.closest('[data-component="tooltip-trigger"]')
    if (!(trigger instanceof HTMLElement)) return
    trigger.tabIndex = 0
    trigger.setAttribute("role", "img")
    trigger.setAttribute("aria-label", label())
    trigger.setAttribute("aria-description", goal()?.text ?? "")
  })

  createEffect(() => {
    const container = row()
    const content = lane()
    const control = badge()
    const caption = text()
    if (
      !working() ||
      !goal()?.active ||
      !label() ||
      !container ||
      !content ||
      !control ||
      !caption ||
      typeof ResizeObserver === "undefined"
    )
      return
    const measure = () => {
      const icon = control.querySelector('[data-component="icon"]')
      if (!icon) return
      const css = getComputedStyle(control)
      const gap = Number.parseFloat(css.getPropertyValue("--goal-label-gap")) || 0
      const padding = Number.parseFloat(css.paddingLeft) + Number.parseFloat(css.paddingRight)
      const required = icon.getBoundingClientRect().width + caption.scrollWidth + gap + padding
      const available = container.getBoundingClientRect().right - content.getBoundingClientRect().right + 8
      setCompact(container.clientWidth === 0 || required > available + 1)
    }
    const observer = new ResizeObserver(measure)
    for (const el of [container, content, control, caption]) observer.observe(el)
    onCleanup(() => observer.disconnect())
    measure()
  })

  const detail = () => (
    <div class="session-goal-tooltip">
      <span>{label()}</span>
      <span>{goal()?.text}</span>
    </div>
  )

  const control = () => (
    <Show when={goal()}>
      {(goal) => (
        <DropdownMenu
          open={open()}
          onOpenChange={(value) => setOpen(actions() && value)}
          placement="top-end"
          gutter={6}
        >
          <Tooltip value={detail()} placement="top">
            <DropdownMenu.Trigger
              as={Button}
              variant="ghost"
              size="small"
              class="session-goal-action"
              disabled={props.readonly || !actions()}
              aria-label={label()}
            >
              <Icon name="target" size="small" />
              {language.t("session.goal.label")}
              <Icon name="chevron-down" size="small" />
            </DropdownMenu.Trigger>
          </Tooltip>
          <DropdownMenu.Portal>
            <DropdownMenu.Content class="session-goal-menu">
              <DropdownMenu.Group>
                <DropdownMenu.GroupLabel class="session-goal-menu-state">
                  {language.t(goal().active ? "session.goal.active" : "session.goal.paused")}
                </DropdownMenu.GroupLabel>
                <div class="session-goal-menu-title">{goal().text}</div>
                <DropdownMenu.Separator />
                <DropdownMenu.Item
                  disabled={props.readonly || !actions() || !server.isConnected()}
                  onSelect={() => session.sendCommand("goal", goal().active ? "pause" : "resume")}
                >
                  <Icon name={goal().active ? "stop" : "play"} size="small" />
                  <DropdownMenu.ItemLabel>
                    {language.t(goal().active ? "session.goal.pause" : "session.goal.resume")}
                  </DropdownMenu.ItemLabel>
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  disabled={props.readonly || !actions() || !server.isConnected()}
                  onSelect={() => session.sendCommand("goal", "clear")}
                >
                  <Icon name="trash" size="small" />
                  <DropdownMenu.ItemLabel>{language.t("session.goal.clear")}</DropdownMenu.ItemLabel>
                </DropdownMenu.Item>
              </DropdownMenu.Group>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu>
      )}
    </Show>
  )

  return (
    <div class="session-dock" data-component="session-dock" data-active={active() ? "" : undefined}>
      <div class="session-dock-state" ref={setRow} data-active={working() ? "" : undefined} aria-hidden={!working()}>
        <div class="session-working" ref={setLane} data-goal={working() && goal()?.active ? "" : undefined}>
          <WorkingIndicator />
          <Show when={working() && goal()?.active}>
            <Tooltip class="session-goal-status" value={detail()} placement="top">
              <span class="session-goal-status-content" ref={setBadge} data-compact={compact() ? "" : undefined}>
                <Icon name="target" size="small" />
                <span class="session-goal-status-label" ref={setText} aria-hidden="true">
                  {label()}
                </span>
              </span>
            </Tooltip>
          </Show>
        </div>
      </div>
      <div class="session-dock-state" data-active={actions() ? "" : undefined} aria-hidden={!actions()}>
        {props.actions?.(control)}
      </div>
    </div>
  )
}
