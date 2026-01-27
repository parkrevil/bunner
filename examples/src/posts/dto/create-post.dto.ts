import { IsString } from '@bunner/core';
import { ApiProperty } from '@bunner/scalar';

export class CreatePostDto {
  @ApiProperty({ description: 'Title of the post', example: 'Hello World' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Content of the post', example: 'This is a content' })
  @IsString()
  content: string;
}
