use std::sync::{mpsc, Arc, Mutex, OnceLock};
use std::thread;

type Job = Box<dyn FnOnce() + Send + 'static>;

pub(crate) enum Task {
    Job(Job),
    Shutdown,
}

static TASK_SENDER: OnceLock<mpsc::SyncSender<Task>> = OnceLock::new();
static WORKER_COUNT: OnceLock<usize> = OnceLock::new();

fn init() -> mpsc::SyncSender<Task> {
    let workers = thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4);
    let capacity = (workers * 512).max(64);
    let (tx, rx) = mpsc::sync_channel::<Task>(capacity);
    let rx = Arc::new(Mutex::new(rx));
    for _ in 0..workers {
        let rx_cloned = Arc::clone(&rx);
        thread::spawn(move || loop {
            let msg = {
                let guard = rx_cloned.lock().unwrap();
                guard.recv()
            };
            match msg {
                Ok(Task::Job(job)) => job(),
                Ok(Task::Shutdown) => break,
                Err(_) => break,
            }
        });
    }
    let _ = WORKER_COUNT.set(workers);
    tx
}

pub fn submit_job(job: Job) -> Result<(), mpsc::TrySendError<Task>> {
    let tx = TASK_SENDER.get_or_init(|| init());
    tx.try_send(Task::Job(job))
}

pub fn shutdown_pool() {
    if let (Some(tx), Some(&workers)) = (TASK_SENDER.get(), WORKER_COUNT.get()) {
        for _ in 0..workers {
            // Block to ensure delivery even if queue is saturated
            let _ = tx.send(Task::Shutdown);
        }
    }
}
