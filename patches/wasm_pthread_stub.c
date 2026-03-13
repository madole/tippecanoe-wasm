/*
 * Minimal pthread_create/join stubs for Emscripten without USE_PTHREADS.
 *
 * Emscripten already provides stubs for mutex functions. We only need to
 * provide pthread_create (which runs the function synchronously) and
 * pthread_join (which is a no-op since work already completed).
 *
 * Most thread creation in tippecanoe goes through thread_create() in
 * thread.cpp, which we've patched to run synchronously under __EMSCRIPTEN__.
 * This stub catches any remaining direct pthread_create calls (plugin.cpp,
 * tile.cpp prefilter).
 */

#ifdef __EMSCRIPTEN__

#include <pthread.h>

static void *_stub_thread_result = NULL;

int pthread_create(pthread_t *thread, const pthread_attr_t *attr,
                   void *(*start_routine)(void *), void *arg) {
    (void)attr;
    _stub_thread_result = start_routine(arg);
    *thread = (pthread_t)1;
    return 0;
}

int pthread_join(pthread_t thread, void **retval) {
    (void)thread;
    if (retval) {
        *retval = _stub_thread_result;
    }
    return 0;
}

#endif
