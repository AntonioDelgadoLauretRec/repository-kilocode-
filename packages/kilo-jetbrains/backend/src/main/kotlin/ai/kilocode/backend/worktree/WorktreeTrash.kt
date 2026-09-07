package ai.kilocode.backend.worktree

import ai.kilocode.log.KiloLog
import com.intellij.openapi.components.Service
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import java.io.IOException
import java.nio.file.FileVisitResult
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.SimpleFileVisitor
import java.nio.file.attribute.BasicFileAttributes
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList

/**
 * Registry and background executor for worktree deletion, so a remove RPC never blocks on a
 * recursive filesystem delete and no polling loop (`stats`, `dirty`, `prStatus`, `branchStatus`, the
 * gh probe) spawns a process inside a directory that is disappearing underneath it.
 *
 * Deletion is rename-then-delete, mirroring the VS Code extension's `WorktreeManager`
 * (`packages/kilo-vscode/src/agent-manager/WorktreeManager.ts`): the caller atomically renames the
 * worktree to a `$PREFIX<uuid>` sibling — which is what makes it vanish from `git worktree list` and
 * from disk-existence checks in a single filesystem operation — then this service deletes that
 * sibling's contents on its own scope. Both clients share the same prefix, so either one sweeps
 * orphans the other left behind (e.g. after a force-quit mid-delete).
 */
@Service(Service.Level.APP)
class WorktreeTrash(private val cs: CoroutineScope) {
    companion object {
        /** Must match the VS Code extension's `TEMP_PREFIX` exactly so orphan sweeps are shared. */
        const val PREFIX = ".kilo-delete-"
        private val LOG = KiloLog.create(WorktreeTrash::class.java)
    }

    /** Paths currently being removed, keyed by their canonical (symlink-resolved) form. */
    private val marked = ConcurrentHashMap.newKeySet<String>()
    private val jobs = CopyOnWriteArrayList<Job>()

    /** Marks [path] as being removed. Callers must pair this with [unmark] via `try`/`finally`. */
    fun mark(path: String) {
        marked.add(canonical(path))
        LOG.info("worktree trash marked: path=$path inflight=${marked.size}")
    }

    fun unmark(path: String) {
        marked.remove(canonical(path))
        LOG.info("worktree trash unmarked: path=$path inflight=${marked.size}")
    }

    /**
     * True when [path] is mid-removal (explicitly [mark]ed) or is itself a staged-for-delete
     * directory (its name starts with [PREFIX]). The second case covers a worktree discovered by a
     * concurrent `git worktree list` before this process ever called [mark], and any leftover from a
     * previous run that has not been swept yet — both must be invisible to every poll just the same
     * as an explicitly marked path.
     */
    fun doomed(path: String): Boolean {
        val name = Path.of(path).normalize().fileName?.toString().orEmpty()
        if (name.startsWith(PREFIX)) return true
        return marked.contains(canonical(path))
    }

    /**
     * Atomically renames [dir] to a `$PREFIX<uuid>` sibling so it disappears from git and from disk
     * existence checks in one filesystem operation. Returns the new path, or null when the rename
     * failed (e.g. cross-device) — the caller falls back to `git worktree remove --force` in that
     * case, so throwing here would only complicate that fallback for no benefit.
     */
    fun stage(dir: Path): Path? {
        val temp = dir.resolveSibling(PREFIX + UUID.randomUUID())
        return try {
            Files.move(dir, temp)
            LOG.info("worktree trash staged: from=$dir to=$temp")
            temp
        } catch (e: Exception) {
            LOG.warn("worktree trash stage failed: from=$dir message=${e.message}", e)
            null
        }
    }

    /** Deletes [temp] recursively on this service's own scope. Never throws into the caller. */
    fun reap(temp: Path) {
        jobs.add(cs.launch(Dispatchers.IO) { reapNow(temp) })
    }

    /**
     * Reaps every `$PREFIX*` directory directly under [storage] — orphans left by an interrupted
     * delete (this process's or the VS Code extension's), or a stage whose reap never ran because
     * the IDE closed first. Safe to call from every `list`/`sync`: listing an ordinary directory is
     * cheap and re-sweeping an already-reaped name is a no-op.
     */
    fun sweep(storage: Path) {
        if (!Files.isDirectory(storage)) return
        jobs.add(
            cs.launch(Dispatchers.IO) {
                val found = runCatching {
                    Files.newDirectoryStream(storage).use { stream ->
                        stream.filter { Files.isDirectory(it) && it.fileName.toString().startsWith(PREFIX) }
                    }
                }.getOrElse {
                    LOG.warn("worktree trash sweep listing failed: storage=$storage message=${it.message}", it)
                    emptyList()
                }
                LOG.info("worktree trash sweep: storage=$storage found=${found.size}")
                found.forEach { reapNow(it) }
            },
        )
    }

    /** Awaits every reap/sweep started so far. Test-only: production code never blocks on this. */
    internal suspend fun drain() {
        val snapshot = jobs.toList()
        snapshot.forEach { it.join() }
        jobs.removeAll(snapshot)
    }

    private fun reapNow(temp: Path) {
        val start = System.currentTimeMillis()
        LOG.info("worktree trash reap start: temp=$temp")
        try {
            deleteRecursively(temp)
            LOG.info("worktree trash reap done: temp=$temp ms=${System.currentTimeMillis() - start}")
        } catch (e: Exception) {
            LOG.warn("worktree trash reap failed: temp=$temp message=${e.message}", e)
        }
    }

    private fun deleteRecursively(root: Path) {
        if (!Files.exists(root)) return
        Files.walkFileTree(
            root,
            object : SimpleFileVisitor<Path>() {
                override fun visitFile(file: Path, attrs: BasicFileAttributes): FileVisitResult {
                    Files.deleteIfExists(file)
                    return FileVisitResult.CONTINUE
                }

                override fun postVisitDirectory(dir: Path, exc: IOException?): FileVisitResult {
                    Files.deleteIfExists(dir)
                    return FileVisitResult.CONTINUE
                }
            },
        )
    }

    /** Same symlink-resolution rule as [ai.kilocode.backend.rpc.samePath]/`realPath`. */
    private fun canonical(path: String): String {
        val file = Path.of(path).normalize()
        return (if (Files.exists(file)) runCatching { file.toRealPath() }.getOrDefault(file) else file).toString()
    }
}
