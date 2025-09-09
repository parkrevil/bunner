use std::sync::{mpsc, Arc, Mutex, OnceLock};
use std::thread;

type Job = Box<dyn FnOnce() + Send + 'static>;
static TASK_SENDER: OnceLock<mpsc::Sender<Job>> = OnceLock::new();

fn init() -> mpsc::Sender<Job> {
    let (tx, rx) = mpsc::channel::<Job>();
    let rx = Arc::new(Mutex::new(rx));
    let workers = thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4);
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

pub fn submit_job(job: Job) {
    let tx = TASK_SENDER.get_or_init(|| init());
    let _ = tx.send(job);
}
