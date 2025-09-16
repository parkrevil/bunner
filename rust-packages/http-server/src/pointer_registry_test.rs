#[cfg(test)]
mod register {
    use crate::pointer_registry as registry;

    #[test]
    fn registers_vec_and_returns_non_null() {
        let v = b"presence".to_vec();
        let p = registry::register(v);
        assert!(!p.is_null());

        // cleanup
        unsafe { registry::free(p); }
    }

    #[test]
    fn registers_multiple_independent_ptrs() {
        let p1 = registry::register(b"one".to_vec());
        let p2 = registry::register(b"one".to_vec());

        assert!(registry::has(p1));
        assert!(registry::has(p2));

        unsafe { registry::free(p1); }
        unsafe { registry::free(p2); }
    }

    // Submodule for large / boundary input cases related to `register`
    mod large_inputs {
        use crate::pointer_registry as registry;

        #[test]
        fn register_zero_length_vec() {
            let v: Vec<u8> = Vec::new();
            let p = registry::register(v);
            assert!(!p.is_null());

            // read back presence and free
            assert!(registry::has(p));
            unsafe { registry::free(p); }
            assert!(!registry::has(p));
        }

        #[test]
        fn register_large_vec() {
            // 10MB buffer to exercise large allocations without being too slow
            let v = vec![0u8; 10 * 1024 * 1024];
            let p = registry::register(v);
            assert!(!p.is_null());
            assert!(registry::has(p));
            unsafe { registry::free(p); }
            assert!(!registry::has(p));
        }
    }

    // Submodule for concurrency-related tests targeting `register`/`free`
    mod concurrent_register {
        use std::thread;

        #[test]
        fn concurrent_register_and_free() {
            // Deterministic threads count
            let threads: usize = 8;
            let mut handles = Vec::new();

            for i in 0..threads {
                handles.push(thread::spawn(move || {
                    let data = vec![i as u8; 1024];
                    let p = crate::pointer_registry::register(data);
                    // brief work
                    for _ in 0..10 { std::hint::black_box(()); }
                    assert!(crate::pointer_registry::has(p));
                    unsafe { crate::pointer_registry::free(p); }
                    assert!(!crate::pointer_registry::has(p));
                }));
            }

            for h in handles {
                let _ = h.join();
            }
        }
    }
}

#[cfg(test)]
mod has {
    use crate::pointer_registry as registry;

    #[test]
    fn returns_false_for_null_pointer() {
        let p: *mut u8 = std::ptr::null_mut();
        assert!(!registry::has(p));
    }

    #[test]
    fn reflects_registration_state_after_free() {
        let p = registry::register(b"has_state".to_vec());
        assert!(registry::has(p));
        unsafe { registry::free(p); }
        assert!(!registry::has(p));
    }
}

#[cfg(test)]
mod free {
    use crate::pointer_registry as registry;

    #[test]
    fn free_frees_and_subsequent_free_is_noop() {
        let p = registry::register(b"single_free".to_vec());

        unsafe { registry::free(p); }
        // second free should be a no-op and not panic
        unsafe { registry::free(p); }

        assert!(!registry::has(p));
    }

    #[test]
    fn free_ignores_null_pointer() {
        let p: *mut u8 = std::ptr::null_mut();
        unsafe { registry::free(p); }
        assert!(!registry::has(p));
    }

    #[test]
    fn free_unknown_pointer_noop() {
        let fake = 0x543210usize as *mut u8;
        unsafe { registry::free(fake); }
        assert!(!registry::has(fake));
    }
}


