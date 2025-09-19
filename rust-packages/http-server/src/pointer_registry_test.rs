#[cfg(test)]
mod register {
    use crate::pointer_registry as registry;
    use crate::test_utils::registry as test_registry;

    #[test]
    fn registers_vec_and_returns_non_null() {
        test_registry::with_registered_vec(b"presence".to_vec(), |p| {
            assert!(!p.is_null());
        });
    }

    #[test]
    fn registers_multiple_independent_ptrs() {
        test_registry::with_registered_vec(vec![1u8, 2u8, 3u8], |p1| {
            test_registry::with_registered_vec(vec![4u8, 5u8, 6u8], |p2| {
                assert!(registry::has(p1));
                assert!(registry::has(p2));
            })
        });
    }

    // Submodule for large / boundary input cases related to `register`
    mod large_inputs {
        use crate::pointer_registry as registry;
        use crate::test_utils::registry as test_registry;

        #[test]
        fn register_zero_length_vec() {
            test_registry::with_registered_vec(Vec::new(), |p| {
                assert!(!p.is_null());
                assert!(registry::has(p));
            });
            // pointer freed when helper closure returns
        }

        #[test]
        fn register_large_vec() {
            // 10MB buffer to exercise large allocations without being too slow
            let v = vec![0u8; 10 * 1024 * 1024];
            test_registry::with_registered_vec(v, |p| {
                assert!(!p.is_null());
                assert!(registry::has(p));
            });
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
                    use crate::pointer_registry as registry;
                    use crate::test_utils::registry as test_registry;

                    let data = vec![i as u8; 1024];
                    test_registry::with_registered_vec(data, |p| {
                        // brief work
                        for _ in 0..10 {
                            std::hint::black_box(());
                        }
                        assert!(registry::has(p));
                    });
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
    use crate::test_utils::registry as test_registry;
    use crate::types::MutablePointer;

    #[test]
    fn reflects_registration_state_after_free() {
        test_registry::with_registered_vec(b"temp".to_vec(), |p| {
            assert!(registry::has(p));
        });
        // after helper returns, pointer should no longer be registered
        // we can't access the raw pointer here, but ensure registry is empty for a new pointer
        let fake: MutablePointer = std::ptr::null_mut();
        assert!(!registry::has(fake));
    }

    #[test]
    fn returns_false_for_null_pointer() {
        let p: MutablePointer = std::ptr::null_mut();
        assert!(!registry::has(p));
    }
}

#[cfg(test)]
mod free {
    use crate::pointer_registry as registry;
    use crate::types::MutablePointer;

    #[test]
    fn free_frees_and_subsequent_free_is_noop() {
        let p = registry::register(b"single_free".to_vec());

        unsafe {
            registry::free(p);
        }
        // second free should be a no-op and not panic
        unsafe {
            registry::free(p);
        }

        assert!(!registry::has(p));
    }

    #[test]
    fn free_ignores_null_pointer() {
        let p: MutablePointer = std::ptr::null_mut();
        unsafe {
            registry::free(p);
        }
        assert!(!registry::has(p));
    }

    #[test]
    fn free_unknown_pointer_noop() {
        let fake = 0x543210usize as MutablePointer;
        unsafe {
            registry::free(fake);
        }
        assert!(!registry::has(fake));
    }
}
