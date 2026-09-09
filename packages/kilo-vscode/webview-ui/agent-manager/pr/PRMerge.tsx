import { Button } from "@kilocode/kilo-ui/button"
import { DropdownMenu } from "@kilocode/kilo-ui/dropdown-menu"
import { Icon } from "@kilocode/kilo-ui/icon"
import { Spinner } from "@kilocode/kilo-ui/spinner"
import { Show, For, createEffect, createSignal, onCleanup } from "solid-js"
import { useLanguage } from "../../src/context/language"
import { useVSCode } from "../../src/context/vscode"
import type { PRMergeMethod, PRStatus } from "../../src/types/messages"
import type { PRMergeRequest } from "../../../src/shared/pr-comment-actions"
import { reviewRequest } from "./pr-review-request"
import { conflictFailed, conflictFiles, setConflictFailed, setConflictFiles } from "./pr-conflict-state"
import { useBaseUpdate } from "../update-from-base"

interface Props {
  pr: PRStatus
  worktreeId: string
  projectId?: string
  sessionId?: string
  mode: "status" | "footer"
}

function label(method: PRMergeMethod, t: (key: string) => string): string {
  if (method === "merge") return t("agentManager.pr.merge.method.merge")
  if (method === "rebase") return t("agentManager.pr.merge.method.rebase")
  return t("agentManager.pr.merge.method.squash")
}

export function PRMerge(props: Props) {
  const { t } = useLanguage()
  const vscode = useVSCode()
  const baseUpdate = useBaseUpdate()
  const [pending, setPending] = createSignal(false)
  const [error, setError] = createSignal<string>()
  const [chosen, setChosen] = createSignal<PRMergeMethod>()
  const [confirming, setConfirming] = createSignal(false)
  const [loadingConflicts, setLoadingConflicts] = createSignal(false)
  const merge = () => props.pr.merge
  const conflictKey = () => `${props.worktreeId}:${props.pr.headRefOid ?? ""}`
  const conflicts = () => (merge()?.mergeable === "conflicting" ? conflictFiles(conflictKey()) : undefined)
  const methods = () => merge()?.methods ?? []
  const selected = () => {
    const value = chosen()
    return value && methods().includes(value) ? value : (merge()?.method ?? methods().at(0) ?? "squash")
  }
  const state = () => merge()?.state ?? "unknown"
  const auto = () => {
    const value = merge()
    const current = state()
    return (
      value?.autoAllowed === true &&
      value.mergeable === "mergeable" &&
      (current === "clean" || current === "blocked" || current === "unstable" || current === "has_hooks")
    )
  }
  const target = () => ({
    projectId: props.projectId,
    worktreeId: props.worktreeId,
    prNumber: props.pr.number,
    prUrl: props.pr.url,
  })
  const send = (message: PRMergeRequest) => {
    if (pending()) return
    setPending(true)
    setError(undefined)
    reviewRequest(message, vscode.postMessage, (result) => {
      if (result.type !== `${message.type}Result`) return
      setPending(false)
      if (!result.success) setError(result.error ?? t("agentManager.pr.merge.failed"))
    })
  }
  const update = () => {
    const head = props.pr.headRefOid
    if (!head) return
    send({
      ...target(),
      type: "agentManager.updatePRBranch",
      requestId: crypto.randomUUID(),
      head,
    })
  }
  const mergePR = (auto: boolean) => {
    const head = props.pr.headRefOid
    if (!head) return
    send({
      ...target(),
      type: "agentManager.mergePR",
      requestId: crypto.randomUUID(),
      method: selected(),
      auto,
      head,
    })
  }
  const disableAuto = () => {
    send({ ...target(), type: "agentManager.disablePRAutoMerge", requestId: crypto.randomUUID() })
  }
  let requestKey: string | undefined
  let cancel: (() => void) | undefined
  createEffect(() => {
    if (props.mode !== "status") return
    const value = merge()
    if (value?.mergeable !== "conflicting") return
    const base = props.pr.baseRefOid
    const head = props.pr.headRefOid
    if (!base || !head) return
    const key = conflictKey()
    if (conflictFiles(key) || conflictFailed(key) || requestKey === key) return
    cancel?.()
    requestKey = key
    setLoadingConflicts(true)
    const dispose = reviewRequest(
      { ...target(), type: "agentManager.loadPRConflicts", requestId: crypto.randomUUID(), base, head },
      vscode.postMessage,
      (result) => {
        if (result.type !== "agentManager.loadPRConflictsResult") return
        setLoadingConflicts(false)
        if (result.success) setConflictFiles(key, result.files ?? [])
        else setConflictFailed(key)
      },
      30_000,
      true,
    )
    cancel = dispose
    onCleanup(() => {
      dispose()
      if (cancel === dispose) cancel = undefined
      if (requestKey === key) {
        requestKey = undefined
        setLoadingConflicts(false)
      }
    })
  })
  const confirm = () => {
    setConfirming(true)
  }
  const fix = () => baseUpdate(props.worktreeId, props.projectId, props.sessionId)
  const statusLabel = () => {
    if (merge()?.mergeable === "conflicting") return t("agentManager.pr.merge.conflicts")
    if (state() === "behind") return t("agentManager.pr.merge.behind")
    if (state() === "blocked") return t("agentManager.pr.merge.blocked")
    if (state() === "unstable") return t("agentManager.pr.merge.unstable")
    if (state() === "draft") return t("agentManager.pr.merge.draft")
    if (state() === "has_hooks") return t("agentManager.pr.merge.checking")
    if (state() === "clean") return t("agentManager.pr.merge.ready")
    return t("agentManager.pr.merge.checking")
  }
  const statusIcon = () => {
    if (merge()?.mergeable === "conflicting" || state() === "unstable" || state() === "behind") return "warning"
    if (state() === "clean") return "circle-check"
    return "warning"
  }

  return (
    <Show when={merge() && props.pr.state === "open" && (props.mode === "status" || merge()?.canWrite)}>
      <Show
        when={props.mode === "status"}
        fallback={
          <div class="am-pr-merge-footer">
            <Show when={confirming()}>
              <div class="am-pr-merge-confirm" role="dialog" aria-label={t("agentManager.pr.merge.confirmTitle")}>
                <span>{t("agentManager.pr.merge.confirmDescription", { method: label(selected(), t) })}</span>
                <span class="am-pr-merge-dialog-actions">
                  <Button variant="ghost" onClick={() => setConfirming(false)}>
                    {t("agentManager.pr.merge.cancel")}
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => {
                      setConfirming(false)
                      mergePR(false)
                    }}
                  >
                    {t("agentManager.pr.merge.confirm")}
                  </Button>
                </span>
              </div>
            </Show>
            <Show when={!confirming()}>
              <Show when={error()}>
                <div class="am-pr-merge-error" role="alert">
                  {error()}
                </div>
              </Show>
              <Show
                when={merge()?.auto}
                fallback={
                  <div class="am-split-button" data-variant="primary">
                    <Button
                      variant="primary"
                      size="small"
                      class="am-pr-merge-action"
                      disabled={pending() || (state() !== "clean" && !auto())}
                      onClick={() => (state() === "clean" ? confirm() : mergePR(true))}
                    >
                      {state() === "clean"
                        ? t("agentManager.pr.merge.button", { method: label(selected(), t) })
                        : t("agentManager.pr.merge.autoButton", { method: label(selected(), t) })}
                    </Button>
                    <DropdownMenu gutter={4} placement="bottom-end">
                      <DropdownMenu.Trigger
                        class="am-split-arrow"
                        disabled={pending()}
                        aria-label={t("agentManager.pr.merge.chooseMethod")}
                      >
                        <Icon name="chevron-down" size="small" />
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content class="am-split-menu">
                          <Show when={auto()}>
                            <DropdownMenu.Item onSelect={() => mergePR(true)}>
                              <span class="am-menu-check" aria-hidden="true" />
                              <DropdownMenu.ItemLabel>
                                {t("agentManager.pr.merge.autoButton", { method: label(selected(), t) })}
                              </DropdownMenu.ItemLabel>
                            </DropdownMenu.Item>
                          </Show>
                          <For each={methods()}>
                            {(item) => (
                              <DropdownMenu.Item onSelect={() => setChosen(item)}>
                                <span class="am-menu-check" aria-hidden="true">
                                  <Show when={selected() === item}>
                                    <Icon name="check" size="small" />
                                  </Show>
                                </span>
                                <DropdownMenu.ItemLabel>{label(item, t)}</DropdownMenu.ItemLabel>
                              </DropdownMenu.Item>
                            )}
                          </For>
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu>
                  </div>
                }
              >
                <div class="am-pr-merge-controls">
                  <Button variant="secondary" disabled={pending()} onClick={disableAuto}>
                    {t("agentManager.pr.merge.disableAuto")}
                  </Button>
                </div>
              </Show>
              <Show when={merge()?.auto}>
                <span class="am-pr-merge-auto-note">{t("agentManager.pr.merge.autoNote")}</span>
              </Show>
            </Show>
          </div>
        }
      >
        <div class="am-pr-merge-block">
          <div
            class="am-pr-summary-row am-pr-row am-pr-merge-status"
            data-status={merge()?.mergeable === "conflicting" ? "error" : state()}
          >
            <div class="am-pr-summary-icon">
              <Show when={state() === "unknown"} fallback={<Icon name={statusIcon()} size="normal" />}>
                <Spinner />
              </Show>
            </div>
            <div class="am-pr-summary-main">
              <strong>{statusLabel()}</strong>
              <Show when={merge()?.mergeable === "conflicting"}>
                <span class="am-pr-merge-hint">{t("agentManager.pr.merge.conflictsHint")}</span>
              </Show>
            </div>
            <Show when={merge()?.mergeable === "conflicting"}>
              <Button variant="secondary" size="small" disabled={pending()} onClick={fix}>
                {t("agentManager.pr.merge.fix")}
              </Button>
            </Show>
            <Show when={merge()?.mergeable !== "conflicting" && state() === "behind"}>
              <Button variant="secondary" size="small" disabled={pending()} onClick={update}>
                {t("agentManager.pr.merge.update")}
              </Button>
            </Show>
          </div>
          <Show when={merge()?.mergeable === "conflicting"}>
            <Show when={loadingConflicts()}>
              <div class="am-pr-conflict-loading am-pr-row">
                <Spinner />
                <span>{t("agentManager.pr.merge.conflictsLoading")}</span>
              </div>
            </Show>
            <Show when={conflicts()?.length}>
              <div class="am-pr-conflict-files">
                <For each={conflicts()}>
                  {(file) => (
                    <div class="am-pr-conflict-file am-pr-row" title={file}>
                      <Icon name="file-tree" size="small" />
                      <span>{file}</span>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </Show>
        </div>
      </Show>
    </Show>
  )
}
