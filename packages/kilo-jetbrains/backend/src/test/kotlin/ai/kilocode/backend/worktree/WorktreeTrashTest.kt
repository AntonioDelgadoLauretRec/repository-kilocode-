package ai.kilocode.backend.worktree

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.runBlocking
import java.nio.file.Files
import java.nio.file.Path
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class WorktreeTrashTest {
    private val root: Path = Files.createTempDirectory("kilo-worktree-trash")
    private val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())
    private val trash = WorktreeTrash(scope)

    @AfterTest
    fun tearDown() {
        scope.cancel()
        delete(root)
    }

    @Test
    fun `mark and unmark toggle doomed for the exact path`() {
        val dir = root.resolve("wt").also { Files.createDirectories(it) }
        assertFalse(trash.doomed(dir.toString()))
        trash.mark(dir.toString())
        assertTrue(trash.doomed(dir.toString()))
        trash.unmark(dir.toString())
        assertFalse(trash.doomed(dir.toString()))
    }

    @Test
    fun `doomed matches a path resolved through a symlink the same as its real target`() {
        val real = root.resolve("real").also { Files.createDirectories(it) }
        val link = root.resolve("link")
        try {
            Files.createSymbolicLink(link, real)
        } catch (e: Exception) {
            return // symlinks unsupported (e.g. some Windows CI configs without privilege) — skip
        }
        trash.mark(link.toString())
        assertTrue(trash.doomed(real.toString()))
    }

    @Test
    fun `doomed is true for any path whose name carries the delete prefix`() {
        val staged = root.resolve("${WorktreeTrash.PREFIX}abc-123")
        assertTrue(trash.doomed(staged.toString()))
    }

    @Test
    fun `stage renames the directory to a delete-prefixed sibling`() = runBlocking {
        val dir = root.resolve("wt").also { Files.createDirectories(it) }
        Files.writeString(dir.resolve("file.txt"), "content")

        val temp = trash.stage(dir)

        assertNotNull(temp)
        assertFalse(Files.exists(dir))
        assertTrue(Files.exists(temp))
        assertTrue(temp.fileName.toString().startsWith(WorktreeTrash.PREFIX))
        assertEquals("content", Files.readString(temp.resolve("file.txt")))
    }

    @Test
    fun `stage returns null without throwing when the source does not exist`() = runBlocking {
        val missing = root.resolve("missing")
        assertNull(trash.stage(missing))
    }

    @Test
    fun `reap deletes a populated tree`() = runBlocking {
        val dir = root.resolve("${WorktreeTrash.PREFIX}reap-me")
        Files.createDirectories(dir.resolve("nested"))
        Files.writeString(dir.resolve("nested").resolve("file.txt"), "x")

        trash.reap(dir)
        trash.drain()

        assertFalse(Files.exists(dir))
    }

    @Test
    fun `reap of an already-gone directory is a no-op`() = runBlocking {
        trash.reap(root.resolve("${WorktreeTrash.PREFIX}never-existed"))
        trash.drain() // must not throw
    }

    @Test
    fun `sweep reaps every delete-prefixed directory and ignores ordinary ones`() = runBlocking {
        val orphanA = root.resolve("${WorktreeTrash.PREFIX}a").also { Files.createDirectories(it) }
        val orphanB = root.resolve("${WorktreeTrash.PREFIX}b").also { Files.createDirectories(it) }
        val kept = root.resolve("kept-worktree").also { Files.createDirectories(it) }

        trash.sweep(root)
        trash.drain()

        assertFalse(Files.exists(orphanA))
        assertFalse(Files.exists(orphanB))
        assertTrue(Files.exists(kept))
    }

    @Test
    fun `sweep on a missing storage directory does not throw`() = runBlocking {
        trash.sweep(root.resolve("missing"))
        trash.drain()
    }

    private fun delete(path: Path) {
        if (!Files.exists(path)) return
        Files.walk(path).use { stream ->
            stream.sorted(Comparator.reverseOrder()).forEach { Files.deleteIfExists(it) }
        }
    }
}
