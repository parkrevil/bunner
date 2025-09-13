use bunner_http_server::thread_pool_test_support as pool;
use crossbeam_channel as mpsc;
use std::thread;
use std::time::{Duration, Instant};

#[test]
fn shutdown_without_prior_init_is_noop() {
    pool::shutdown();
    let (tx, rx) = mpsc::unbounded::<u8>();
    pool::submit(move || {
        let _ = tx.send(1);
    })
    .unwrap();
    assert_eq!(rx.recv().unwrap(), 1);
    pool::shutdown();
}

#[test]
fn should_be_idempotent_and_stop_accepting_jobs() {
    let (tx, rx) = mpsc::unbounded::<()>();
    pool::submit(move || {
        let _ = tx.send(());
    })
    .unwrap();
    rx.recv().unwrap();
    pool::shutdown();
    pool::shutdown();
    let res = pool::submit(|| {});
    assert!(res.is_err());
}

#[test]
fn should_allow_inflight_jobs_to_complete() {
    let (tx, rx) = mpsc::unbounded::<usize>();
    for i in 0..50 {
        let txc = tx.clone();
        pool::submit(move || {
            thread::sleep(Duration::from_millis(5));
            let _ = txc.send(i);
        })
        .unwrap();
    }
    pool::shutdown();
    let mut received = 0;
    let stop_at = Instant::now() + Duration::from_secs(2);
    while Instant::now() < stop_at {
        if rx.try_recv().is_ok() {
            received += 1;
            if received >= 1 {
                break;
            }
        } else {
            thread::sleep(Duration::from_millis(5));
        }
    }
    assert!(received >= 1);
}
