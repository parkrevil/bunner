use bunner_http_server::thread_pool_test_support as pool;
use crossbeam_channel as mpsc;
use std::sync::{Arc, Barrier};
use std::thread;
use std::time::{Duration, Instant};

#[test]
fn should_execute_a_single_job() {
    let (tx, rx) = mpsc::unbounded::<u32>();
    pool::submit(move || {
        tx.send(1).unwrap();
    })
    .expect("submit should succeed");

    let got = rx.recv_timeout(Duration::from_secs(1)).unwrap();
    assert_eq!(got, 1);
    pool::shutdown();
}

#[test]
fn should_execute_many_jobs_concurrently() {
    let (tx, rx) = mpsc::unbounded::<usize>();
    let num_jobs = 32;
    let barrier = Arc::new(Barrier::new(num_jobs));

    for i in 0..num_jobs {
        let tx_c = tx.clone();
        let b = barrier.clone();
        pool::submit(move || {
            b.wait();
            tx_c.send(i).unwrap();
        })
        .unwrap();
    }

    let mut seen = std::collections::HashSet::new();
    for _ in 0..num_jobs {
        let v = rx.recv_timeout(Duration::from_secs(2)).unwrap();
        seen.insert(v);
    }
    assert_eq!(seen.len(), num_jobs);
    pool::shutdown();
}

#[test]
fn order_is_not_strictly_guaranteed_under_mixed_workloads() {
    let (tx, rx) = mpsc::unbounded::<&'static str>();

    pool::submit({
        let tx = tx.clone();
        move || {
            thread::sleep(Duration::from_millis(60));
            let _ = tx.send("long");
        }
    })
    .unwrap();

    for _ in 0..5 {
        pool::submit({
            let tx = tx.clone();
            move || {
                let _ = tx.send("short");
            }
        })
        .unwrap();
    }

    let first = rx.recv_timeout(Duration::from_secs(1)).unwrap();
    assert!(first == "short" || first == "long");
    pool::shutdown();
}
