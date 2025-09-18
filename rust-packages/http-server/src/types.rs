pub type AppId = u64;

 pub type RequestKey = u64;

pub type HandleRequestCallback = extern "C" fn(RequestKey, u16, *mut u8);
