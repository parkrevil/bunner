pub type AppId = u8;

pub type HandleRequestCallback = extern "C" fn(*mut u8, u16, *mut u8);
