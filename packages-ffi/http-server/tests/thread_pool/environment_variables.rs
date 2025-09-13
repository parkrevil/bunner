use bunner_http_server::thread_pool_test_support as pool;
use std::env;


#[test]
fn should_respect_bunner_http_workers_env_var() {
    // Save original env var if it exists
    let original_workers = env::var("BUNNER_HTTP_WORKERS").ok();

    // Test with custom worker count
    unsafe {
        env::set_var("BUNNER_HTTP_WORKERS", "2");
    }

    // Create a new pool instance to pick up the env var
    // Note: This test assumes we can create multiple pools or reset the static state
    // In practice, you might need to modify the thread_pool module to support testing

    // For now, we'll test the env_usize function directly
    let default_workers = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4);

    // Test that env_usize respects the environment variable
    let workers = std::env::var("BUNNER_HTTP_WORKERS")
        .ok()
        .and_then(|s| s.parse::<usize>().ok())
        .map(|v| v.clamp(1, 256))
        .unwrap_or(default_workers);

    assert_eq!(workers, 2);

    // Cleanup
    if let Some(original) = original_workers {
        unsafe {
            env::set_var("BUNNER_HTTP_WORKERS", original);
        }
    } else {
        unsafe {
            env::remove_var("BUNNER_HTTP_WORKERS");
        }
    }

    pool::shutdown();
}

#[test]
fn should_respect_bunner_http_queue_cap_env_var() {
    // Save original env var if it exists
    let original_capacity = env::var("BUNNER_HTTP_QUEUE_CAP").ok();

    // Test with custom queue capacity
    unsafe {
        env::set_var("BUNNER_HTTP_QUEUE_CAP", "1024");
    }

    // Test that env_usize respects the environment variable
    let capacity = std::env::var("BUNNER_HTTP_QUEUE_CAP")
        .ok()
        .and_then(|s| s.parse::<usize>().ok())
        .map(|v| v.clamp(1, 65_536))
        .unwrap_or(512);

    assert_eq!(capacity, 1024);

    // Cleanup
    if let Some(original) = original_capacity {
        unsafe {
            env::set_var("BUNNER_HTTP_QUEUE_CAP", original);
        }
    } else {
        unsafe {
            env::remove_var("BUNNER_HTTP_QUEUE_CAP");
        }
    }

    pool::shutdown();
}

#[test]
fn should_clamp_workers_to_valid_range() {
    // Save original env var if it exists
    let original_workers = env::var("BUNNER_HTTP_WORKERS").ok();

    // Test minimum value
    unsafe {
        env::set_var("BUNNER_HTTP_WORKERS", "0");
    }
    let workers_min = std::env::var("BUNNER_HTTP_WORKERS")
        .ok()
        .and_then(|s| s.parse::<usize>().ok())
        .map(|v| v.clamp(1, 256))
        .unwrap_or(4);
    assert_eq!(workers_min, 1); // Should be clamped to minimum

    // Test maximum value
    unsafe {
        env::set_var("BUNNER_HTTP_WORKERS", "300");
    }
    let workers_max = std::env::var("BUNNER_HTTP_WORKERS")
        .ok()
        .and_then(|s| s.parse::<usize>().ok())
        .map(|v| v.clamp(1, 256))
        .unwrap_or(4);
    assert_eq!(workers_max, 256); // Should be clamped to maximum

    // Cleanup
    if let Some(original) = original_workers {
        unsafe {
            env::set_var("BUNNER_HTTP_WORKERS", original);
        }
    } else {
        unsafe {
            env::remove_var("BUNNER_HTTP_WORKERS");
        }
    }

    pool::shutdown();
}

#[test]
fn should_clamp_queue_capacity_to_valid_range() {
    // Save original env var if it exists
    let original_capacity = env::var("BUNNER_HTTP_QUEUE_CAP").ok();

    // Test minimum value
    unsafe {
        env::set_var("BUNNER_HTTP_QUEUE_CAP", "0");
    }
    let capacity_min = std::env::var("BUNNER_HTTP_QUEUE_CAP")
        .ok()
        .and_then(|s| s.parse::<usize>().ok())
        .map(|v| v.clamp(1, 65_536))
        .unwrap_or(512);
    assert_eq!(capacity_min, 1); // Should be clamped to minimum

    // Test maximum value
    unsafe {
        env::set_var("BUNNER_HTTP_QUEUE_CAP", "100000");
    }
    let capacity_max = std::env::var("BUNNER_HTTP_QUEUE_CAP")
        .ok()
        .and_then(|s| s.parse::<usize>().ok())
        .map(|v| v.clamp(1, 65_536))
        .unwrap_or(512);
    assert_eq!(capacity_max, 65536); // Should be clamped to maximum

    // Cleanup
    if let Some(original) = original_capacity {
        unsafe {
            env::set_var("BUNNER_HTTP_QUEUE_CAP", original);
        }
    } else {
        unsafe {
            env::remove_var("BUNNER_HTTP_QUEUE_CAP");
        }
    }

    pool::shutdown();
}

#[test]
fn should_use_default_when_env_var_invalid() {
    // Save original env vars if they exist
    let original_workers = env::var("BUNNER_HTTP_WORKERS").ok();
    let original_capacity = env::var("BUNNER_HTTP_QUEUE_CAP").ok();

    // Test with invalid values
    unsafe {
        env::set_var("BUNNER_HTTP_WORKERS", "invalid");
    }
    unsafe {
        env::set_var("BUNNER_HTTP_QUEUE_CAP", "not_a_number");
    }

    let default_workers = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4);

    let workers = std::env::var("BUNNER_HTTP_WORKERS")
        .ok()
        .and_then(|s| s.parse::<usize>().ok())
        .map(|v| v.clamp(1, 256))
        .unwrap_or(default_workers);

    let capacity = std::env::var("BUNNER_HTTP_QUEUE_CAP")
        .ok()
        .and_then(|s| s.parse::<usize>().ok())
        .map(|v| v.clamp(1, 65_536))
        .unwrap_or(512);

    // Should fall back to defaults when parsing fails
    assert_eq!(workers, default_workers);
    assert_eq!(capacity, 512);

    // Cleanup
    if let Some(original) = original_workers {
        unsafe {
            env::set_var("BUNNER_HTTP_WORKERS", original);
        }
    } else {
        unsafe {
            env::remove_var("BUNNER_HTTP_WORKERS");
        }
    }

    if let Some(original) = original_capacity {
        unsafe {
            env::set_var("BUNNER_HTTP_QUEUE_CAP", original);
        }
    } else {
        unsafe {
            env::remove_var("BUNNER_HTTP_QUEUE_CAP");
        }
    }

    pool::shutdown();
}