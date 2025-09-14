#[cfg(test)]
mod register {
    use crate::pointer_registry as registry;
    use std::ffi::CString;
    use std::os::raw::c_char;

    #[test]
    fn registers_pointer_and_reports_presence() {
        let c = CString::new("presence").unwrap();
        let p = registry::register_cstring_and_into_raw(c);
        assert!(!p.is_null());
        assert!(registry::has(p));

        // cleanup by using the public free (registry owns this allocation)
        unsafe {
            registry::free(p);
        }
        assert!(!registry::has(p));
    }

    #[test]
    fn register_ignores_null_pointer() {
        let p: *mut c_char = std::ptr::null_mut();
        // should be a no-op and remain unregistered
        registry::register(p);
        assert!(!registry::has(p));
    }

    #[test]
    fn double_register_updates_tag_no_panic() {
        let c = CString::new("double_register").unwrap();
        let p = registry::register_cstring_and_into_raw(c);
        // registering a raw pointer again should not panic and should leave it present
        registry::register(p);
        assert!(registry::has(p));

        unsafe {
            registry::free(p);
        }
    }
}

#[cfg(test)]
mod unregister {
    use crate::pointer_registry as registry;
    use std::ffi::CString;
    use std::os::raw::c_char;

    #[test]
    fn unregisters_pointer_and_reports_absence() {
        let c = CString::new("unregister").unwrap();
        let p = registry::register_cstring_and_into_raw(c);
        assert!(registry::has(p));
        registry::unregister(p);
        assert!(!registry::has(p));

        // since unregister does not free the allocation, free it manually to avoid leak
        unsafe {
            let _ = CString::from_raw(p);
        }
    }

    #[test]
    fn unregister_ignores_null_pointer() {
        let p: *mut c_char = std::ptr::null_mut();
        registry::unregister(p);
        assert!(!registry::has(p));
    }

    #[test]
    fn unregister_unknown_pointer_noop() {
        let fake = 0x12345usize as *mut c_char;
        // should be safe: unregister will log but not panic or alter unrelated state
        registry::unregister(fake);
        assert!(!registry::has(fake));
    }
}

#[cfg(test)]
mod has {
    use crate::pointer_registry as registry;
    use std::ffi::CString;
    use std::os::raw::c_char;

    #[test]
    fn reports_false_for_null_pointer() {
        let p: *mut c_char = std::ptr::null_mut();
        assert!(!registry::has(p));
    }

    #[test]
    fn has_reflects_registration_state() {
        let c = CString::new("has_state").unwrap();
        let p = registry::register_cstring_and_into_raw(c);
        assert!(registry::has(p));
        unsafe {
            registry::free(p);
        }
        assert!(!registry::has(p));
    }
}

#[cfg(test)]
mod free {
    use crate::pointer_registry as registry;
    use std::ffi::CString;
    use std::os::raw::c_char;

    #[test]
    fn frees_pointer_once_and_no_double_free() {
        let c = CString::new("single_free").unwrap();
        let p = registry::register_cstring_and_into_raw(c);

        unsafe {
            registry::free(p);
        }
        // second free should be a no-op and not panic (registry will log warning)
        unsafe {
            registry::free(p);
        }

        assert!(!registry::has(p));
    }

    #[test]
    fn free_ignores_null_pointer() {
        let p: *mut c_char = std::ptr::null_mut();
        unsafe {
            registry::free(p);
        }
        assert!(!registry::has(p));
    }

    #[test]
    fn free_unknown_pointer_noop() {
        let fake = 0x543210usize as *mut c_char;
        // calling free on an unknown/non-registered pointer should not call from_raw
        // and therefore is safe (only logs). It must not panic.
        unsafe {
            registry::free(fake);
        }
        assert!(!registry::has(fake));
    }
}

#[cfg(test)]
mod register_cstring_and_into_raw {
    use crate::pointer_registry as registry;
    use std::ffi::CString;

    #[test]
    fn register_and_cleanup_roundtrip() {
        let c = CString::new("roundtrip").unwrap();
        let p = registry::register_cstring_and_into_raw(c);
        assert!(registry::has(p));
        unsafe {
            registry::free(p);
        }
        assert!(!registry::has(p));
    }
}
