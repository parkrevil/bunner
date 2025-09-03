use bumpalo::Bump;
use core::ptr::NonNull;

use super::RadixNode;

#[repr(transparent)]
#[derive(Clone)]
pub(super) struct NodeBox(pub(super) NonNull<RadixNode>);

impl NodeBox {
    #[inline(always)]
    pub fn from_arena(arena: &Bump) -> Self {
        let node_ref: &mut RadixNode = arena.alloc(RadixNode::default());
        Self(NonNull::from(node_ref))
    }
    #[inline(always)]
    pub fn as_ref(&self) -> &RadixNode {
        unsafe { self.0.as_ref() }
    }
    #[inline(always)]
    pub fn as_mut(&mut self) -> &mut RadixNode {
        unsafe { self.0.as_mut() }
    }
}

impl core::ops::Deref for NodeBox {
    type Target = RadixNode;
    #[inline(always)]
    fn deref(&self) -> &Self::Target {
        self.as_ref()
    }
}

impl core::ops::DerefMut for NodeBox {
    #[inline(always)]
    fn deref_mut(&mut self) -> &mut Self::Target {
        self.as_mut()
    }
}

impl core::fmt::Debug for NodeBox {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.debug_tuple("NodeBox")
            .field(&(self.0.as_ptr() as usize))
            .finish()
    }
}

#[inline(always)]
pub(super) fn new_node_box_from_arena_ptr(arena_ptr: *const Bump) -> NodeBox {
    let arena_ref = unsafe { &*arena_ptr };
    NodeBox::from_arena(arena_ref)
}
