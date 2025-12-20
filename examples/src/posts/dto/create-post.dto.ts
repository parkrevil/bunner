import { IsString } from '@bunner/core';

export class CreatePostDto {
  @IsString()
  title: string;

  @IsString()
  content: string;
}
