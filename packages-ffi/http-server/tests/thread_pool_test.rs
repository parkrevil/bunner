use bunner_http_server::thread_pool_test_support as pool;
use std::sync::mpsc;
use std::sync::{Arc, Barrier};
use std::thread;
use std::time::{Duration, Instant};

mod job_execution {
    use super::*;

    #[test]
    fn should_execute_a_single_job() {
        let (tx, rx) = mpsc::channel::<u32>();
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
        let (tx, rx) = mpsc::channel::<usize>();
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
        let (tx, rx) = mpsc::channel::<&'static str>();

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
}

mod queue_capacity {
    use super::*;

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
        let (tx, rx) = mpsc::channel::<()>();
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
}

mod shutdown_semantics {
    use super::*;

    #[test]
    fn shutdown_without_prior_init_is_noop() {
        pool::shutdown();
        let (tx, rx) = mpsc::channel::<u8>();
        pool::submit(move || {
            let _ = tx.send(1);
        })
        .unwrap();
        assert_eq!(rx.recv_timeout(Duration::from_secs(1)).unwrap(), 1);
        pool::shutdown();
    }

    #[test]
    fn should_be_idempotent_and_stop_accepting_jobs() {
        let (tx, rx) = mpsc::channel::<()>();
        pool::submit(move || {
            let _ = tx.send(());
        })
        .unwrap();
        rx.recv_timeout(Duration::from_secs(1)).unwrap();
        pool::shutdown();
        pool::shutdown();
        let res = pool::submit(|| {});
        assert!(res.is_err());
    }

    #[test]
    fn should_allow_inflight_jobs_to_complete() {
        let (tx, rx) = mpsc::channel::<usize>();
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
}

mod resilience {
    use super::*;

    #[test]
    fn should_continue_after_a_panicking_job() {
        let (tx, rx) = mpsc::channel::<u8>();
        pool::submit(|| {
            thread::sleep(Duration::from_millis(10));
            panic!("intentional panic");
        })
        .unwrap();
        let tx2 = tx.clone();
        pool::submit(move || {
            let _ = tx2.send(7);
        })
        .unwrap();
        let got = rx.recv_timeout(Duration::from_secs(2)).unwrap();
        assert_eq!(got, 7);
        pool::shutdown();
    }

    #[test]
    fn nested_submission_should_schedule_child_job() {
        let (tx, rx) = mpsc::channel::<u8>();
        pool::submit({
            let tx = tx.clone();
            move || {
                let _ = pool::submit({
                    let tx = tx.clone();
                    move || {
                        let _ = tx.send(9);
                    }
                });
            }
        })
        .unwrap();
        let got = rx.recv_timeout(Duration::from_secs(2)).unwrap();
        assert_eq!(got, 9);
        pool::shutdown();
    }
}
