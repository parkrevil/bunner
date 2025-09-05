use bunner_http_server::router::{Method, RouterBuilder};
use criterion::{black_box, criterion_group, criterion_main, Criterion, Throughput};
use libc::{c_int, pid_t};
use std::fs;
use std::path::Path;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

#[inline]
fn bench_sample_size(routes: usize) -> usize {
    let n = if routes <= 100 {
        8
    } else if routes <= 1_000 {
        6
    } else if routes <= 10_000 {
        5
    } else {
        3
    };
    n.max(10)
}

#[inline]
fn bench_measure_secs(routes: usize) -> u64 {
    match routes {
        0..=100 => 2,
        101..=1_000 => 2,
        1_001..=10_000 => 3,
        _ => 4,
    }
}

#[global_allocator]
static GLOBAL: jemallocator::Jemalloc = jemallocator::Jemalloc;

const ROUTE_COUNTS: &[usize] = &[100, 1000, 5000, 10000];
const TOTAL_LOOKUPS: u64 = 1_000_000;

#[derive(Clone, Copy)]
enum Kind {
    Register,
    Lookup,
    LookupMiss,
}

#[derive(Clone, Copy)]
struct Sample {
    elapsed_ns: f64,
    total_calls: f64,
    router_cache_hit_rate: f64,
    router_cache_miss_rate: f64,
    cand_avg: f64,
    cand_p50: f64,
    cand_p99: f64,
    static_per_req: f64,
    rss_bytes: f64,
    branch_mispredict_rate: f64,
    l1_miss_rate: f64,
    l2_miss_rate: f64,
    l3_miss_rate: f64,
    fragmentation: f64,
}
use std::collections::{BTreeMap, HashMap};
struct Accum {
    times: usize,
    reg_by: BTreeMap<usize, HashMap<&'static str, Vec<Sample>>>,
    hit_by: BTreeMap<usize, HashMap<&'static str, Vec<Sample>>>,
    miss_by: BTreeMap<usize, HashMap<&'static str, Vec<Sample>>>,
}
impl Accum {
    fn new() -> Self {
        Self {
            times: TOTAL_LOOKUPS as usize,
            reg_by: BTreeMap::new(),
            hit_by: BTreeMap::new(),
            miss_by: BTreeMap::new(),
        }
    }
    #[allow(clippy::too_many_arguments)]
    fn record(
        &mut self,
        kind: Kind,
        routes: usize,
        label: &'static str,
        elapsed: Duration,
        total_calls: u64,
        router_cache_hit_rate: f64,
        router_cache_miss_rate: f64,
        cand_avg: f64,
        cand_p50: f64,
        cand_p99: f64,
        static_per_req: f64,
        rss_bytes: f64,
        branch_mispredict_rate: f64,
        l1_miss_rate: f64,
        l2_miss_rate: f64,
        l3_miss_rate: f64,
        fragmentation: f64,
    ) {
        let s = Sample {
            elapsed_ns: elapsed.as_secs_f64() * 1e9,
            total_calls: total_calls as f64,
            router_cache_hit_rate,
            router_cache_miss_rate,
            cand_avg,
            cand_p50,
            cand_p99,
            static_per_req,
            rss_bytes,
            branch_mispredict_rate,
            l1_miss_rate,
            l2_miss_rate,
            l3_miss_rate,
            fragmentation,
        };
        match kind {
            Kind::Register => {
                let m = self.reg_by.entry(routes).or_default();
                m.entry(label).or_default().push(s)
            }
            Kind::Lookup => {
                let m = self.hit_by.entry(routes).or_default();
                m.entry(label).or_default().push(s)
            }
            Kind::LookupMiss => {
                let m = self.miss_by.entry(routes).or_default();
                m.entry(label).or_default().push(s)
            }
        }
    }
}
static ACC: OnceLock<Mutex<Accum>> = OnceLock::new();
fn acc() -> &'static Mutex<Accum> {
    ACC.get_or_init(|| Mutex::new(Accum::new()))
}

#[inline]
fn current_allocated_bytes() -> u64 {
    let _ = jemalloc_ctl::epoch::mib().and_then(|m| m.advance());
    jemalloc_ctl::stats::allocated::mib()
        .and_then(|m| m.read())
        .unwrap_or(0) as u64
}

#[inline]
fn current_fragmentation_ratio() -> f64 {
    let _ = jemalloc_ctl::epoch::mib().and_then(|m| m.advance());
    let allocated = jemalloc_ctl::stats::allocated::mib()
        .and_then(|m| m.read())
        .unwrap_or(0);
    let active = jemalloc_ctl::stats::active::mib()
        .and_then(|m| m.read())
        .unwrap_or(0);
    if active > 0 {
        ((active - allocated) as f64) / (active as f64)
    } else {
        0.0
    }
}

#[cfg(target_os = "linux")]
#[allow(unused_unsafe)]
mod perfcount {
    use super::*;
    use std::mem::size_of;
    use std::os::fd::RawFd;

    #[repr(C)]
    #[allow(non_camel_case_types)]
    struct perf_event_attr {
        type_: u32,
        size: u32,
        config: u64,
        sample_period: u64,
        sample_type: u64,
        read_format: u64,
        flags: u64,
    }

    const PERF_TYPE_HARDWARE: u32 = 0;
    const PERF_TYPE_HW_CACHE: u32 = 3;
    const PERF_COUNT_HW_BRANCH_INSTRUCTIONS: u64 = 5;
    const PERF_COUNT_HW_BRANCH_MISSES: u64 = 6;

    const PERF_COUNT_HW_CACHE_L1D: u64 = 0;
    const PERF_COUNT_HW_CACHE_LL: u64 = 3;
    const PERF_COUNT_HW_CACHE_OP_READ: u64 = 0;
    const PERF_COUNT_HW_CACHE_RESULT_ACCESS: u64 = 0;
    const PERF_COUNT_HW_CACHE_RESULT_MISS: u64 = 1;

    fn pe_config_cache(cache: u64, op: u64, result: u64) -> u64 {
        (cache) | (op << 8) | (result << 16)
    }

    fn perf_event_open(
        attr: &mut perf_event_attr,
        pid: pid_t,
        cpu: c_int,
        group_fd: c_int,
        flags: c_int,
    ) -> RawFd {
        unsafe {
            libc::syscall(
                libc::SYS_perf_event_open,
                attr as *mut perf_event_attr,
                pid,
                cpu,
                group_fd,
                flags,
            ) as RawFd
        }
    }

    const PERF_EVENT_IOC_ENABLE: libc::c_ulong = 0x2400;
    const PERF_EVENT_IOC_DISABLE: libc::c_ulong = 0x2401;
    const PERF_EVENT_IOC_RESET: libc::c_ulong = 0x2403;

    pub struct Counters {
        fd_br: RawFd,
        fd_br_miss: RawFd,
        fd_l1_ref: RawFd,
        fd_l1_miss: RawFd,
        fd_ll_ref: RawFd,
        fd_ll_miss: RawFd,
        ok: bool,
    }

    impl Counters {
        pub fn start() -> Self {
            let mut a_br = perf_event_attr {
                type_: PERF_TYPE_HARDWARE,
                size: size_of::<perf_event_attr>() as u32,
                config: PERF_COUNT_HW_BRANCH_INSTRUCTIONS,
                sample_period: 0,
                sample_type: 0,
                read_format: 0,
                flags: 1, /* disabled=1 */
            };
            let mut a_br_m = perf_event_attr {
                type_: PERF_TYPE_HARDWARE,
                size: size_of::<perf_event_attr>() as u32,
                config: PERF_COUNT_HW_BRANCH_MISSES,
                sample_period: 0,
                sample_type: 0,
                read_format: 0,
                flags: 1,
            };
            let mut a_l1_ref = perf_event_attr {
                type_: PERF_TYPE_HW_CACHE,
                size: size_of::<perf_event_attr>() as u32,
                config: pe_config_cache(
                    PERF_COUNT_HW_CACHE_L1D,
                    PERF_COUNT_HW_CACHE_OP_READ,
                    PERF_COUNT_HW_CACHE_RESULT_ACCESS,
                ),
                sample_period: 0,
                sample_type: 0,
                read_format: 0,
                flags: 1,
            };
            let mut a_l1_miss = perf_event_attr {
                type_: PERF_TYPE_HW_CACHE,
                size: size_of::<perf_event_attr>() as u32,
                config: pe_config_cache(
                    PERF_COUNT_HW_CACHE_L1D,
                    PERF_COUNT_HW_CACHE_OP_READ,
                    PERF_COUNT_HW_CACHE_RESULT_MISS,
                ),
                sample_period: 0,
                sample_type: 0,
                read_format: 0,
                flags: 1,
            };
            let mut a_ll_ref = perf_event_attr {
                type_: PERF_TYPE_HW_CACHE,
                size: size_of::<perf_event_attr>() as u32,
                config: pe_config_cache(
                    PERF_COUNT_HW_CACHE_LL,
                    PERF_COUNT_HW_CACHE_OP_READ,
                    PERF_COUNT_HW_CACHE_RESULT_ACCESS,
                ),
                sample_period: 0,
                sample_type: 0,
                read_format: 0,
                flags: 1,
            };
            let mut a_ll_miss = perf_event_attr {
                type_: PERF_TYPE_HW_CACHE,
                size: size_of::<perf_event_attr>() as u32,
                config: pe_config_cache(
                    PERF_COUNT_HW_CACHE_LL,
                    PERF_COUNT_HW_CACHE_OP_READ,
                    PERF_COUNT_HW_CACHE_RESULT_MISS,
                ),
                sample_period: 0,
                sample_type: 0,
                read_format: 0,
                flags: 1,
            };

            let pid = 0; // self
            let fd_br = perf_event_open(&mut a_br, pid, -1, -1, 0);
            let fd_br_miss = perf_event_open(&mut a_br_m, pid, -1, fd_br, 0);
            let fd_l1_ref = perf_event_open(&mut a_l1_ref, pid, -1, fd_br, 0);
            let fd_l1_miss = perf_event_open(&mut a_l1_miss, pid, -1, fd_br, 0);
            let fd_ll_ref = perf_event_open(&mut a_ll_ref, pid, -1, fd_br, 0);
            let fd_ll_miss = perf_event_open(&mut a_ll_miss, pid, -1, fd_br, 0);

            let mut c = Counters {
                fd_br,
                fd_br_miss,
                fd_l1_ref,
                fd_l1_miss,
                fd_ll_ref,
                fd_ll_miss,
                ok: true,
            };
            // enable
            for &fd in [
                c.fd_br,
                c.fd_br_miss,
                c.fd_l1_ref,
                c.fd_l1_miss,
                c.fd_ll_ref,
                c.fd_ll_miss,
            ]
            .iter()
            {
                if fd >= 0 {
                    unsafe { libc::ioctl(fd, PERF_EVENT_IOC_RESET, 0) };
                    unsafe { libc::ioctl(fd, PERF_EVENT_IOC_ENABLE, 0) };
                } else {
                    c.ok = false;
                }
            }
            c
        }

        pub fn stop_and_rates(&self) -> (f64, f64, f64) {
            fn read_fd(fd: RawFd) -> u64 {
                let mut v: u64 = 0;
                let n = unsafe {
                    libc::read(fd, &mut v as *mut _ as *mut _, std::mem::size_of::<u64>())
                };
                if n as isize == std::mem::size_of::<u64>() as isize {
                    v
                } else {
                    0
                }
            }
            if !self.ok {
                return (f64::NAN, f64::NAN, f64::NAN);
            }
            for &fd in [
                self.fd_br,
                self.fd_br_miss,
                self.fd_l1_ref,
                self.fd_l1_miss,
                self.fd_ll_ref,
                self.fd_ll_miss,
            ]
            .iter()
            {
                if fd >= 0 {
                    unsafe { libc::ioctl(fd, PERF_EVENT_IOC_DISABLE, 0) };
                }
            }
            let br = read_fd(self.fd_br) as f64;
            let br_m = read_fd(self.fd_br_miss) as f64;
            let l1r = read_fd(self.fd_l1_ref) as f64;
            let l1m = read_fd(self.fd_l1_miss) as f64;
            let llr = read_fd(self.fd_ll_ref) as f64;
            let llm = read_fd(self.fd_ll_miss) as f64;
            let br_rate = if br > 0.0 { br_m / br } else { f64::NAN };
            let l1_rate = if l1r > 0.0 { l1m / l1r } else { f64::NAN };
            let ll_rate = if llr > 0.0 { llm / llr } else { f64::NAN };
            (br_rate, l1_rate, ll_rate)
        }
    }
}

#[cfg(not(target_os = "linux"))]
mod perfcount {
    pub struct Counters;
    impl Counters {
        pub fn start() -> Self {
            Counters
        }
        pub fn stop_and_rates(&self) -> (f64, f64, f64) {
            (f64::NAN, f64::NAN, f64::NAN)
        }
    }
}

#[inline]
fn method_from_str(m: &str) -> Method {
    match m {
        "GET" => Method::GET,
        "POST" => Method::POST,
        "PUT" => Method::PUT,
        "PATCH" => Method::PATCH,
        "DELETE" => Method::DELETE,
        "OPTIONS" => Method::OPTIONS,
        "HEAD" => Method::HEAD,
        _ => Method::GET,
    }
}

#[derive(Clone)]
struct Route {
    method: Method,
    path: String,
    mapped: String,
}

fn parse_routes(p: &str) -> Vec<Route> {
    let data = fs::read_to_string(p).expect("routes file");
    let routes_raw: Vec<serde_json::Value> = serde_json::from_str(&data).unwrap();
    routes_raw
        .into_iter()
        .filter_map(|r| {
            let m = r.get("httpMethod")?.as_str().unwrap_or("GET");
            let path = r.get("path")?.as_str()?;
            let mapped = r.get("mapped").and_then(|v| v.as_str()).unwrap_or(path);
            Some(Route {
                method: method_from_str(m),
                path: path.to_string(),
                mapped: mapped.to_string(),
            })
        })
        .collect()
}

fn load_routes_file(p: &str) -> &'static Vec<Route> {
    static SIMPLE: OnceLock<Vec<Route>> = OnceLock::new();
    static MEDIUM: OnceLock<Vec<Route>> = OnceLock::new();
    static HIGH: OnceLock<Vec<Route>> = OnceLock::new();
    static EXTREME: OnceLock<Vec<Route>> = OnceLock::new();
    let target = Path::new(p)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("");
    match target {
        "routes_simple.json" => SIMPLE.get_or_init(|| parse_routes(p)),
        "routes_medium.json" => MEDIUM.get_or_init(|| parse_routes(p)),
        "routes_high.json" => HIGH.get_or_init(|| parse_routes(p)),
        "routes_extreme.json" => EXTREME.get_or_init(|| parse_routes(p)),
        _ => SIMPLE.get_or_init(|| parse_routes(p)),
    }
}

fn build_from_slice(slice: &[Route]) -> bunner_http_server::router::RouterHandle {
    let mut b = RouterBuilder::new();
    for r in slice.iter() {
        b = b.add(r.method, r.path.as_str());
    }
    b.seal().build()
}

fn bench_register_phase(c: &mut Criterion, label: &'static str, file: &str, count: usize) {
    let routes = load_routes_file(file);
    let n = routes.len().min(count);
    let slice = &routes[..n];
    let mut group = c.benchmark_group("register");
    group.warm_up_time(Duration::from_secs(1));
    group.measurement_time(Duration::from_secs(bench_measure_secs(n)));
    group.sample_size(bench_sample_size(n));
    group.throughput(Throughput::Elements(1));
    group.bench_function(label, |bch| {
        bch.iter_batched(
            perfcount::Counters::start,
            |pc| {
                let start_alloc = current_allocated_bytes();
                let start = Instant::now();
                let h = build_from_slice(slice);
                black_box(&h);
                let elapsed = start.elapsed();
                let (br_rate, l1_rate, l3_rate) = pc.stop_and_rates();
                let frag = current_fragmentation_ratio();
                let end_alloc = current_allocated_bytes();
                let alloc_delta = if end_alloc > start_alloc {
                    (end_alloc - start_alloc) as f64
                } else {
                    0.0
                };
                if let Ok(mut g) = acc().lock() {
                    g.record(
                        Kind::Register,
                        n,
                        label,
                        elapsed,
                        1,
                        f64::NAN,
                        f64::NAN,
                        f64::NAN,
                        f64::NAN,
                        f64::NAN,
                        f64::NAN,
                        alloc_delta,
                        br_rate,
                        l1_rate,
                        f64::NAN,
                        l3_rate,
                        frag,
                    );
                }
            },
            criterion::BatchSize::SmallInput,
        )
    });
    group.finish();
}

fn bench_lookup_phase(c: &mut Criterion, label: &'static str, file: &str, count: usize) {
    let routes = load_routes_file(file);
    let n = routes.len().min(count);
    let slice = &routes[..n];
    let mut h: bunner_http_server::router::RouterHandle = build_from_slice(slice);
    // reset metrics before measuring
    h.reset_metrics();
    // warm priming
    for r in slice.iter() {
        let _ = h.find(r.method, r.mapped.as_str());
    }
    let mut group = c.benchmark_group("find");
    group.warm_up_time(Duration::from_secs(1));
    group.measurement_time(Duration::from_secs(bench_measure_secs(n)));
    group.sample_size(bench_sample_size(n));
    group.throughput(Throughput::Elements(1));
    group.bench_function(label, |bch| {
        bch.iter_custom(|_iters| {
            let pc = perfcount::Counters::start();
            h.reset_metrics();
            let start_alloc = current_allocated_bytes();
            let start = Instant::now();
            let mut total_calls: u64 = 0;
            let total_target = TOTAL_LOOKUPS;
            let per_route = if n > 0 { total_target / (n as u64) } else { 0 };
            for r in slice.iter() {
                for _ in 0..per_route {
                    let res = h.find(r.method, black_box(r.mapped.as_str()));
                    black_box(&res);
                    total_calls += 1;
                }
            }
            let elapsed = start.elapsed();
            let metrics = h.metrics();
            let end_alloc = current_allocated_bytes();
            let alloc_delta = if end_alloc > start_alloc {
                (end_alloc - start_alloc) as f64
            } else {
                0.0
            };
            let (br_rate, l1_rate, l3_rate) = pc.stop_and_rates();
            let frag = current_fragmentation_ratio();
            let lookups = (metrics.cache_lookups as f64).max(1.0);
            let hit_rate = (metrics.cache_hits as f64) / lookups;
            let miss_rate = (metrics.cache_misses as f64) / lookups;
            let static_per_req = if total_calls > 0 {
                (metrics.static_hits as f64) / (total_calls as f64)
            } else {
                0.0
            };
            if let Ok(mut g) = acc().lock() {
                g.record(
                    Kind::Lookup,
                    n,
                    label,
                    elapsed,
                    total_calls,
                    hit_rate,
                    miss_rate,
                    metrics.cand_avg,
                    metrics.cand_p50,
                    metrics.cand_p99,
                    static_per_req,
                    alloc_delta,
                    br_rate,
                    l1_rate,
                    f64::NAN,
                    l3_rate,
                    frag,
                );
            }
            elapsed
        })
    });
    group.finish();

    let miss_path: &str = match label {
        "simple" => "/__not_found__/health",
        "medium" => "/api/v1/unknown/resource",
        "high" => "/api_v2/organizations/00/projects/00/unknown",
        _ => "/not/exist/aaaaaaaa/bbbbb/cccc",
    };
    let mut miss_group = c.benchmark_group("find_miss");
    miss_group.warm_up_time(Duration::from_secs(1));
    miss_group.measurement_time(Duration::from_secs(bench_measure_secs(n)));
    miss_group.sample_size(bench_sample_size(n));
    miss_group.throughput(Throughput::Elements(1));
    miss_group.bench_function(label, |bch| {
        bch.iter_custom(|_iters| {
            let pc = perfcount::Counters::start();
            h.reset_metrics();
            let start_alloc = current_allocated_bytes();
            let start = Instant::now();
            let mut total_calls: u64 = 0;
            let total_target = TOTAL_LOOKUPS;
            for _ in 0..total_target {
                let res = h.find(Method::GET, black_box(miss_path));
                black_box(&res);
                total_calls += 1;
            }
            let elapsed = start.elapsed();
            let metrics = h.metrics();
            let end_alloc = current_allocated_bytes();
            let alloc_delta = if end_alloc > start_alloc {
                (end_alloc - start_alloc) as f64
            } else {
                0.0
            };
            let (br_rate, l1_rate, l3_rate) = pc.stop_and_rates();
            let frag = current_fragmentation_ratio();
            let lookups = (metrics.cache_lookups as f64).max(1.0);
            let hit_rate = (metrics.cache_hits as f64) / lookups;
            let miss_rate = (metrics.cache_misses as f64) / lookups;
            if let Ok(mut g) = acc().lock() {
                g.record(
                    Kind::LookupMiss,
                    n,
                    label,
                    elapsed,
                    total_calls,
                    hit_rate,
                    miss_rate,
                    metrics.cand_avg,
                    metrics.cand_p50,
                    metrics.cand_p99,
                    0.0,
                    alloc_delta,
                    br_rate,
                    l1_rate,
                    f64::NAN,
                    l3_rate,
                    frag,
                );
            }
            elapsed
        })
    });
    miss_group.finish();
}

fn write_summary() {
    let guard = acc().lock().unwrap();
    let levels = ["simple", "medium", "high", "extreme"];
    fn pct(mut xs: Vec<f64>, p: f64) -> f64 {
        if xs.is_empty() {
            f64::NAN
        } else {
            xs.sort_by(|a, b| a.partial_cmp(b).unwrap());
            let i = ((xs.len() as f64 - 1.0) * p).round() as usize;
            xs[i]
        }
    }
    fn summarize(v: &[Sample]) -> serde_json::Value {
        let per_req: Vec<f64> = v
            .iter()
            .map(|s| {
                if s.total_calls > 0.0 {
                    s.elapsed_ns / s.total_calls
                } else {
                    s.elapsed_ns
                }
            })
            .collect();
        let p50 = pct(per_req.clone(), 0.50);
        let p99 = pct(per_req.clone(), 0.99);
        let sum_elapsed: f64 = v.iter().map(|s| s.elapsed_ns).sum();
        let sum_calls: f64 = v.iter().map(|s| s.total_calls).sum();
        let avg = if sum_calls > 0.0 {
            sum_elapsed / sum_calls
        } else {
            f64::NAN
        };
        let qps = if sum_elapsed > 0.0 {
            (sum_calls) / (sum_elapsed / 1e9)
        } else {
            f64::NAN
        };
        let mem_bytes = if v.is_empty() {
            f64::NAN
        } else {
            v.iter().map(|s| s.rss_bytes).sum::<f64>() / (v.len() as f64)
        };
        let br_misp = if v.is_empty() {
            f64::NAN
        } else {
            v.iter().map(|s| s.branch_mispredict_rate).sum::<f64>() / (v.len() as f64)
        };
        let l1_miss = if v.is_empty() {
            f64::NAN
        } else {
            v.iter().map(|s| s.l1_miss_rate).sum::<f64>() / (v.len() as f64)
        };
        let l2_miss = if v.is_empty() {
            f64::NAN
        } else {
            v.iter().map(|s| s.l2_miss_rate).sum::<f64>() / (v.len() as f64)
        };
        let l3_miss = if v.is_empty() {
            f64::NAN
        } else {
            v.iter().map(|s| s.l3_miss_rate).sum::<f64>() / (v.len() as f64)
        };
        // values already bound with desired names above
        serde_json::json!({
            "total_estimated_ns": sum_elapsed,
            "p50_latency_ns": p50,
            "p99_latency_ns": p99,
            "avg_latency_ns": avg,
            "qps": qps,
            "memory_bytes": mem_bytes,
            "static_match_per_req": if v.is_empty() { f64::NAN } else { v.iter().map(|s| s.static_per_req).sum::<f64>() / (v.len() as f64) },
            "router_cache": { "hit_rate": if v.is_empty() { f64::NAN } else { v.iter().map(|s| s.router_cache_hit_rate).sum::<f64>() / (v.len() as f64) },
                               "miss_rate": if v.is_empty() { f64::NAN } else { v.iter().map(|s| s.router_cache_miss_rate).sum::<f64>() / (v.len() as f64) } },
            "cand_size": { "avg": if v.is_empty() { f64::NAN } else { v.iter().map(|s| s.cand_avg).sum::<f64>() / (v.len() as f64) },
                            "p50": if v.is_empty() { f64::NAN } else { v.iter().map(|s| s.cand_p50).sum::<f64>() / (v.len() as f64) },
                            "p99": if v.is_empty() { f64::NAN } else { v.iter().map(|s| s.cand_p99).sum::<f64>() / (v.len() as f64) } },
            "branch_mispredict_rate": br_misp,
            "cache_hit_miss": {"l1": l1_miss, "l2": l2_miss, "l3": l3_miss},
            "memory_fragmentation": if v.is_empty() { 0.0 } else { v.iter().map(|s| s.fragmentation).sum::<f64>() / (v.len() as f64) }
        })
    }
    let mut by_routes: serde_json::Map<String, serde_json::Value> = serde_json::Map::new();
    for (routes, map) in guard.reg_by.iter() {
        let mut node = serde_json::json!({
            "register": { "levels": {} },
            "lookup": { "times": guard.times, "levels": {} },
            "lookup_miss": { "times": guard.times, "levels": {} },
        });
        for &lv in levels.iter() {
            if let Some(v) = map.get(lv) {
                node["register"]["levels"][lv] = summarize(v);
            }
            if let Some(hm) = guard.hit_by.get(routes).and_then(|m| m.get(lv)) {
                node["lookup"]["levels"][lv] = summarize(hm);
            }
            if let Some(mm) = guard.miss_by.get(routes).and_then(|m| m.get(lv)) {
                node["lookup_miss"]["levels"][lv] = summarize(mm);
            }
        }
        by_routes.insert(routes.to_string(), node);
    }
    let summary = serde_json::Value::Object(by_routes);
    let bench_root = if let Ok(td) = std::env::var("CARGO_TARGET_DIR") {
        std::path::Path::new(&td).join("benchmarks")
    } else {
        std::path::Path::new("target").join("benchmarks")
    };
    let _ = std::fs::create_dir_all(&bench_root);
    let out = bench_root.join("http-server_router.json");
    let _ = std::fs::write(out, serde_json::to_string_pretty(&summary).unwrap());
}

fn benches_main(c: &mut Criterion) {
    for &cnt in ROUTE_COUNTS.iter() {
        bench_register_phase(c, "simple", "benches/routes_simple.json", cnt);
        bench_register_phase(c, "medium", "benches/routes_medium.json", cnt);
        bench_register_phase(c, "high", "benches/routes_high.json", cnt);
        bench_register_phase(c, "extreme", "benches/routes_extreme.json", cnt);

        bench_lookup_phase(c, "simple", "benches/routes_simple.json", cnt);
        bench_lookup_phase(c, "medium", "benches/routes_medium.json", cnt);
        bench_lookup_phase(c, "high", "benches/routes_high.json", cnt);
        bench_lookup_phase(c, "extreme", "benches/routes_extreme.json", cnt);
    }

    write_summary();
}

criterion_group! {
    name = benches;
    config = Criterion::default().configure_from_args().without_plots();
    targets = benches_main
}
criterion_main!(benches);
