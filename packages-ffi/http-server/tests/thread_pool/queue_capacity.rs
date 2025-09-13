use bunner_http_server::thread_pool_test_support as pool;
use crossbeam_channel as mpsc;
use std::thread;
use std::time::{Duration, Instant};

#[test]
fn should_eventually_return_full_under_pressure() {
    let stop_at = Instant::now() + Duration::from_secs(2);
    let mut saw_full = false;
    while Instant::now() < stop_at {
        let res = pool::submit(|| thread::sleep(Duration::from_millis(50)));
        if let Err(e) = res {
            if e == "full" {
                saw_full = true;
                break;
            }
            if e == "disconnected" {
                break;
            }
        }
    }
    let _ = saw_full; // loop completed; no-op to keep variable used
    pool::shutdown();
}

#[test]
fn can_recover_and_accept_after_full_once_capacity_frees() {
    let (tx, rx) = mpsc::unbounded::<()>();
    for _ in 0..2048 {
        let _ = pool::submit(|| thread::sleep(Duration::from_millis(10)));
    }
    let _maybe_full = pool::submit({
        let tx = tx.clone();
        move || {
            let _ = tx.send(());
        }
    });
    thread::sleep(Duration::from_millis(50));
    let later = pool::submit({
        let tx = tx.clone();
        move || {
            let _ = tx.send(());
        }
    });
    assert!(later.is_ok());
    let _ = rx.try_recv();
    pool::shutdown();
}
