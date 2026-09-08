/**
 * "Hand this to Kilo" actions shared by the PR summary and the PR sections.
 *
 * Both places must agree on what is still actionable and must send the same
 * payload, so the counts in the summary match the section buttons and a send
 * from either place marks the same items as sent.
 */
import { sendReviewComments } from "../../diff-viewer/review-annotations"
import { SEND_LIMIT, prConversationPayload, prPayload } from "./pr-comment-payload"
import { type CommentState, patchCommentState } from "./pr-comment-state"
import type { PRComment, PRConversationComment } from "./pr-types"

export type JumpTarget = "checks" | "comments" | "conversation"

/** Resolved state with the user's unconfirmed pick applied. */
export function resolvedFor(comment: PRComment, state: CommentState): boolean {
  return state.pending[comment.threadId] ?? comment.resolved
}

/** Unresolved review threads not yet handed to the agent. */
export function unsentThreads(comments: PRComment[], state: CommentState): string[] {
  return comments.filter((item) => !resolvedFor(item, state) && !state.sent[item.threadId]).map((item) => item.threadId)
}

/** Human conversation comments not yet sent or dismissed. */
export function actionableConversation(comments: PRConversationComment[], state: CommentState): string[] {
  return comments.filter((c) => !c.isBot && !state.sent[c.id] && !state.dismissed[c.id]).map((c) => c.id)
}

export function sendThreads(
  worktree: string,
  comments: PRComment[],
  ids: string[],
  state: CommentState,
  terminal?: string,
): void {
  const index = new Map(comments.map((item) => [item.threadId, item]))
  const batch = ids
    .flatMap((id) => {
      const comment = index.get(id)
      return comment && !state.sent[id] ? [comment] : []
    })
    .slice(0, SEND_LIMIT)
  if (batch.length === 0) return
  sendReviewComments(batch.map(prPayload), terminal)
  patchCommentState(worktree, (prev) => {
    const sent = { ...prev.sent }
    for (const item of batch) sent[item.threadId] = true
    return { sent }
  })
}

export function sendConversation(
  worktree: string,
  comments: PRConversationComment[],
  ids: string[],
  state: CommentState,
  terminal?: string,
): void {
  const index = new Map(comments.map((c) => [c.id, c]))
  const batch = ids
    .flatMap((id) => {
      const comment = index.get(id)
      return comment && !state.sent[id] ? [comment] : []
    })
    .slice(0, SEND_LIMIT)
  if (batch.length === 0) return
  sendReviewComments(batch.map(prConversationPayload), terminal)
  patchCommentState(worktree, (prev) => {
    const sent = { ...prev.sent }
    for (const item of batch) sent[item.id] = true
    return { sent }
  })
}
