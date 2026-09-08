import type { PRCommentRequest, PRCommentResult } from "../../../src/shared/pr-comment-actions"

// Keep the result listener alive while a pending card is collapsed or remounted.
export function reviewRequest(
  message: PRCommentRequest,
  post: (message: never) => void,
  settle: (result: PRCommentResult) => void,
) {
  const handler = (event: MessageEvent<PRCommentResult>) => {
    const result = event.data
    if (
      result?.type !== `${message.type}Result` ||
      result.requestId !== message.requestId ||
      result.worktreeId !== message.worktreeId
    )
      return
    // Legacy comment results lack PR identity and only require an explicit project to match.
    const legacy = message.type === "agentManager.replyComment" || message.type === "agentManager.mutateComment"
    if ((!legacy || message.projectId) && result.projectId !== message.projectId) return
    if (
      message.type === "agentManager.replyComment" &&
      (!("threadId" in result) || result.threadId !== message.threadId)
    )
      return
    if (!legacy && (!("prNumber" in result) || result.prNumber !== message.prNumber || result.prUrl !== message.prUrl))
      return
    window.removeEventListener("message", handler)
    settle(result)
  }
  window.addEventListener("message", handler)
  post(message as never)
}
