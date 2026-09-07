# Agent Manager Replies

## Goal

Let an agent reply to an Agent Manager prompt and resume the session that sent it. Reuse the existing prompt delivery and queue. Do not add a message broker or durable delivery ledger.

## Plan

1. Preserve the sender session ID already supplied by the tool runtime. Pass it through the extension bridge when delivering a prompt.
2. Add a system-generated context block to the delivered message. Include the sender session ID, request ID, and instructions to return the result with `agent_manager action: "prompt"` targeting that sender. Clearly label the content as a peer-agent request, not user authorization.
3. Add an optional `replyTo` request ID to the prompt action. Validate it against the original delivered message: the current session must be the original recipient, and the target must be the original sender. Keep this metadata with the message, not in a session-level "last sender" field.
4. Deliver the reply through the existing prompt path. An idle sender starts a new turn; a busy sender uses the existing queue. Include the original request context so the sender can identify which request the reply answers.
5. Mark replies as responses that do not require an acknowledgement. Do not automatically forward final answers or automatically reply to replies.
6. Return clear errors for unavailable or blocked destinations. Support verified original senders in local/sidebar sessions as well as managed worktree sessions, without creating new sessions.

## Focused Tests

- A prompts B, B replies, and idle A resumes.
- A receives the reply while busy through the existing queue.
- Two senders contact B, and B replies to the correct requests in reverse order.
- A session cannot reply using another session's request reference.
- Replies do not create automatic reply loops.
- Closed sessions, pending questions, and permission blockers produce clear errors without bypassing them.

## Scope Limit

Acceptance means the existing prompt endpoint accepted the submission, not that the agent completed it. The bridge deduplicates retries while it remains alive, but this first version does not guarantee delivery across backend or extension restarts. Do not add automatic retries until backend admission is idempotent.
