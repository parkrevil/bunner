use bunner_http_server::thread_pool_test_support as pool;
use crossbeam_channel as mpsc;
use std::thread;
use std::time::Duration;

#[test]
fn should_continue_after_a_panicking_job() {
    let (tx, rx) = mpsc::unbounded::<u8>();
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
    let got = rx.recv().unwrap();
    assert_eq!(got, 7);
    pool::shutdown();
}

#[test]
fn nested_submission_should_schedule_child_job() {
    let (tx, rx) = mpsc::unbounded::<u8>();
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
    let got = rx.recv().unwrap();
    assert_eq!(got, 9);
    pool::shutdown();
}
