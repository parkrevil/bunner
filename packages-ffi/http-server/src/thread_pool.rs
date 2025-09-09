use std::sync::{mpsc, Arc, Mutex, OnceLock};
use std::thread;

type Job = Box<dyn FnOnce() + Send + 'static>;
static TASK_SENDER: OnceLock<mpsc::SyncSender<Job>> = OnceLock::new();

fn init() -> mpsc::SyncSender<Job> {
    // Bounded queue for backpressure
    // Capacity proportional to cores; minimum 64
    let workers = thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4);
    let capacity = (workers * 256).max(64);
    let (tx, rx) = mpsc::sync_channel::<Job>(capacity);
    let rx = Arc::new(Mutex::new(rx));
    for _ in 0..workers {
        let rx_cloned = Arc::clone(&rx);
        thread::spawn(move || loop {
            let msg = {
                let guard = rx_cloned.lock().unwrap();
                guard.recv()
            };
            match msg {
                Ok(job) => job(),
                Err(_) => break,
            }
        });
    }
    tx
}

pub fn submit_job(job: Job) -> Result<(), mpsc::TrySendError<Job>> {
    let tx = TASK_SENDER.get_or_init(|| init());
    tx.try_send(job)
}
