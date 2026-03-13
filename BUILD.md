# Build Documentation for tippecanoe-wasm

## Emscripten SDK Version

- **emsdk version**: 5.0.2 (dc80f645)
- **Platform**: macOS Darwin (arm64)

## Dependency Versions

- **zlib**: latest from github.com/madler/zlib (compiled as static lib)
- **SQLite**: 3.48.0 amalgamation (compiled with SQLITE_THREADSAFE=0)
- **Tippecanoe**: v2.80.0 from github.com/felt/tippecanoe
- **libdeflate**: compiled but not linked (tippecanoe uses zlib directly)

## Source Patches

### 1. `thread.cpp` — Single-threaded execution for WASM

Under `#ifdef __EMSCRIPTEN__`, `thread_create()` runs the thread function
synchronously instead of calling `pthread_create`. This is the main threading
wrapper used throughout tippecanoe.

**Diff:**
```diff
+#ifdef __EMSCRIPTEN__
+static void *last_thread_result = NULL;
+int thread_create(pthread_t *thread, const pthread_attr_t *attr, void *(*start_routine)(void *), void *arg) {
+    (void) attr;
+    last_thread_result = start_routine(arg);
+    *thread = (pthread_t)1;
+    return 0;
+}
+#else
 // ... original code ...
+#endif
```

### 2. `wasm_pthread_stub.c` — New file: pthread_create/join stubs

Provides synchronous implementations of `pthread_create` and `pthread_join`
for code paths that call them directly (plugin.cpp, tile.cpp prefilter).
Emscripten already provides mutex stubs, so only create/join needed stubbing.

### 3. `Makefile.wasm` — New file: Emscripten build configuration

Custom Makefile for the WASM build. Key flags:
- `-Wno-c++11-narrowing` to suppress uint64_t → size_t narrowing in pmtiles.hpp (safe in 32-bit WASM)
- `-s ERROR_ON_UNDEFINED_SYMBOLS=0` to allow linking despite missing POSIX calls (fork, exec, waitpid) used by the plugin/filter subsystem

## Deviations from Original Build Prompt

1. **libdeflate not linked**: The prompt specified libdeflate as a dependency, but tippecanoe's Makefile only links `-lz` and `-lsqlite3`. libdeflate was compiled but is not used.

2. **`allocateUTF8` removed from EXPORTED_RUNTIME_METHODS**: This function is not available in Emscripten 5.x. It was listed in the prompt but is unnecessary for our wrapper.

3. **`-f` flag needed in test**: The smoke test passes `-f` (force) to tippecanoe because `callMain` may be invoked on a module where the output path "exists" from a prior virtual FS state.

4. **Threading approach**: Instead of fully disabling threads, we provide synchronous stubs that run thread functions inline. This allows tippecanoe's threading logic to execute without modification — it just happens to run sequentially.

## Known Warnings (Harmless)

- `unsupported syscall: __syscall_prlimit64` — Linux resource limit call, no effect in WASM
- `unsupported syscall: __syscall_madvise` — memory advisory, no effect in WASM virtual memory
- `"tippecanoe: No such file or directory"` — from `-f` flag checking for existing output, expected on fresh MEMFS

## Rebuild Instructions

```bash
# Source Emscripten
source ~/emsdk/emsdk_env.sh

# Set paths
export WASM_SYSROOT=~/Developer/Sandbox/WASM/tippecanoe/sysroot

# Build dependencies (if not already built)
# See phases 3-5 in the original prompt

# Build tippecanoe WASM
cd ~/Developer/Sandbox/WASM/tippecanoe/tippecanoe
emmake make -f Makefile.wasm clean
emmake make -f Makefile.wasm -j$(sysctl -n hw.ncpu)

# Test
cd ~/Developer/Sandbox/WASM/tippecanoe
node wrapper/test.js
```
