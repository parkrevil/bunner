export interface PostComment {
  id: number;
  postId: number;
  content: string;
}

export interface PostCommentInput {
  content: string;
}
